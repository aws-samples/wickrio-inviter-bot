// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const didYouMean = require('didyoumean')
const WickrBot = require('wickrbot')
const Room = require('./room')

// MAX_ROOM_NAME_LENGTH is the number of characters which can be used for room names
const MAX_ROOM_NAME_LENGTH = 64
// ROOM_REFRESH_INTERVAL_MS is the amount of time in milliseconds to wait between calls
// to cmdGetRooms, which will update the local state of rooms which the bot manages
const ROOM_REFRESH_INTERVAL_MS = 60_000

class RoomBot extends WickrBot {
  // TODO: maybe consider some network-level visibilities as well
  visibilities = ['public', 'private', 'hidden']
  helpText = 'Hi! I\'m a bot for creating and joining shared rooms in Wickr.\n\n' +
    'Rooms managed by this bot will have a visibility assigned to them which controls ' +
    'how other users can find and join the room.\n\n' +
    ' - public: Any user can list or join the room. If the bot is not a moderator of the room,' +
    ' an invite request will be sent instead.\n' +
    ' - private: The room is publicly listed, but users must be invited\n' +
    ' - hidden: The room is unlisted and invite-only\n\n' +
    'You can create a new managed room with `/create` or assign moderator privileges to ' +
    'this bot in an existing room.'

  constructor(wickr, username) {
    super(wickr, username)
    this.statePath = 'roombot/state'
    this.state = {
      rooms: {},
    }

    // Wait for bot to start before interacting with Wickr APIs
    this.on('start', () => {
      this.loadState()
      this._updateRooms.call(this)
      this.timer = setInterval(this._updateRooms.bind(this), ROOM_REFRESH_INTERVAL_MS)
    })

    this.listen('create', this.create.bind(this), {
      description: 'Creates a new managed room. e.g. `/create Zombie Incident Room`',
    })

    this.listen('list', this.list.bind(this), {
      description: 'List public and private rooms.',
    })

    this.listen('join', this.join.bind(this), {
      description: 'Join a room by name. e.g. `/join Zombie Incident Room`',
    })

    this.listen('visibility', this.visibility.bind(this), {
      description: 'Displays or adjusts the visibility of the current room.',
    })

    this.listen('describe', this.describe.bind(this), {
      hidden: true,
    })

    this.listen('delist', this.delist.bind(this), {
      description: 'Removes a room from the Room Bot. e.g. `/delist Zombie Incident Room`',
    })

    this.listen('add', this.addListener.bind(this), {
      description: 'Add a user to the current room. e.g. `/add bob@example.com`',
    })
  }

  _updateRooms() {
    console.debug('Updating room state')
    let response
    try {
      response = this.getRooms()
      if (!('rooms' in response)) throw Error('No rooms in response')
    } catch (error) {
      console.log(`Error getting rooms from server. Response: ${response}, Error: ${error}`)
      return
    }

    for (const roomVal of response.rooms) {
      const room = Room.fromGetRoomResponse(roomVal)

      // BUG: There is some bug here where the getRooms response will return rooms which the
      // bot was a member in, which could cause it to list rooms which it has been delisted
      // It seems like the client is caching a list of vgroupids which it knew about.

      try {
        const roomState = this._getRoomByVgroupId(room.vgroupid)

        // TODO: handle room title changes
        roomState.members = room.members
        roomState.moderators = room.moderators
        roomState.description = room.description
        roomState.lastUpdated = Date.now()
      } catch (error) {
        // This can happen if we're added to a room and given moderator privs
        // TODO: only catch the specific room not found error here
        if (room.title in this.state.rooms) {
          console.warn(`Added to room with conflicting title: "${room.title}"`)
          console.warn(`New: ${room.vgroupid}, Existing: ${this.state.rooms[room.title].vgroupid}`)
          continue
        }

        this.state.rooms[room.title] = room
      }
    }

    this.saveState()
  }

  create(msg, args) {
    const sender = msg.sender
    const title = args.join(' ')

    if (args.length === 0) {
      this.send(msg.vgroupid, 'To create a room, provide the room name with the create command, e.g. `/create Casual Meme Room`')
      return
    }

    if (title.length > MAX_ROOM_NAME_LENGTH) {
      this.send(msg.vgroupid, 'Error: Room name is too long')
      return
    }

    if (Object.keys(this.state.rooms).includes(title)) {
      this.send(msg.vgroupid, 'Error: A room with this name already exists')
      return
    }

    console.log(`Creating room ${title} owned by ${sender}`)

    let response
    try {
      response = this.createRoom(sender, sender, title)
      response = JSON.parse(response)
    } catch (error) {
      console.error(`Error parsing createRoom response: ${error.message}. Response:`, response)
      this.sendToUser(sender, `Error: Failed to create room: ${error.message}`)
      return
    }

    const vgroupid = response.vgroupid
    if (!vgroupid) {
      this.sendToUser(sender, 'Error: Missing vgroupid in response from server')
      return
    }

    const room = new Room(title, vgroupid, sender)
    this.state.rooms[title] = room
    this.saveState()

    this.sendToUser(sender, `Room created successfully! You are now the moderator of "${title}".`)
    this.send(vgroupid, '🥳 You have started a new room!\n\n' +
      `The visibility of this room is currently set to '${room.visibility}'. ` +
      'To change the visibility, use the `/visibility` command.',
    )
  }

  list(msg) {
    const roomList = []

    for (const roomName in this.state.rooms) {
      const room = this.state.rooms[roomName]

      if (room.visibility === 'hidden') continue

      let line = `• ${room.title}`
      if (room.visibility === 'private') {
        line += ' (private)'
      }
      roomList.push(line)
    }

    let response = '*Room List*\n' + roomList.join('\n')
    if (roomList.length === 0) {
      response = 'No rooms found 🙁 Start the movement with `/create`'
    }

    this.sendToUser(msg.sender, response)
  }

  _getRoomByVgroupId(vgroupid) {
    for (const roomName in this.state.rooms) {
      const room = this.state.rooms[roomName]
      if (vgroupid === room.vgroupid) return room
    }
    throw Error('Unable to find details for room')
  }

  visibility(msg, args) {
    if (msg.receiver) {
      this.sendToUser(msg.sender, 'Error: This command is only valid in managed rooms')
      return
    }

    const vgroupid = msg.vgroupid
    let room

    try {
      room = this._getRoomByVgroupId(vgroupid)
    } catch (error) {
      this.send(vgroupid, `Error: ${error.message}`)
      return
    }

    if (args.length === 0) {
      // TODO: Encourage them to make me a moderator if the room is `public`.
      this.send(vgroupid, `The visibility of this room is currently '${room.visibility}'. ` +
        'To change the visibility pass an argument to this command, e.g. `/visibility public`.',
      )
      return
    }

    const visibility = args[0].toLowerCase()

    if (!this.visibilities.includes(visibility)) {
      this.send(vgroupid, 'Error: Invalid visibility setting')
      return
    }

    if (!room.isModerator(msg.sender)) {
      this.send(vgroupid, 'Error: You must be a moderator of this room to change the visibility.')
      return
    }

    console.log(`Updating visibility for "${room.title}" to ${visibility}`)
    room.visibility = visibility
    this.saveState()
    this.send(vgroupid, `Visibility successfully updated to '${visibility}'`)
  }

  join(msg, args) {
    // TODO: limit to 1 join request to prevent spam
    const title = args.join(' ')
    const user = msg.sender

    const room = this.state.rooms[title]

    if (!room) {
      const suggestion = didYouMean(title, Object.keys(this.state.rooms))
      if (suggestion) {
        const properties = {
          meta: {
            buttons: [
              {
                type: 'message',
                text: `Join ${suggestion}`,
                message: `/join ${suggestion}`,
              },
              {
                type: 'message',
                text: 'List Rooms',
                message: '/list',
              },
            ],
          },
        }
        this.sendToUser(user, `Room not found. Did you mean '${suggestion}'?`, properties)
      } else {
        this.sendToUser(user, 'Error: 404 Room Not Found')
      }
      return
    }

    if (room.isMember(user)) {
      this.sendToUser(user, 'You are already a member of that room')
      return
    }

    // TODO make a class PublicRoom PrivateRoom, etc.
    if (room.visibility === 'public' && room.isModerator(this.username)) {
      this.updateRoom(room.vgroupid, { members: [user] })
      this.sendToUser(user, `You have been successfully added to "${title}"`)
    } else {
      this.send(room.vgroupid, `📨 Invite request: user ${user} has requested to be added to this room`)
      this.sendToUser(user, `An invite request has been sent to "${title}"`)
    }
  }

  describe(msg, args) {
    const title = args.join(' ')
    const user = msg.sender
    const room = this.state.rooms[title]

    if (!room) {
      this.sendToUser(user, 'Error: 404 Room Not Found')
      return
    }

    if (room.isMember(user) || room.isOwner(user)) {
      this.sendToUser(user, room.toString())
    } else {
      this.sendToUser(user, 'You must be a member of a room to describe it')
    }
  }

  delist(msg, args) {
    const title = args.join(' ')
    const user = msg.sender

    // TODO: DRY this logic w/ a _getRoomByTitle function
    const room = this.state.rooms[title]

    if (!room) {
      this.sendToUser(user, 'Error: 404 Room Not Found')
      return
    }
    // TODO: handle a room w/ no moderators or only the bot moderator
    if (!room.isModerator(user)) {
      this.sendToUser(user, 'You must be a moderator of the room to delist it')
      return
    }

    console.log(`Delisting room ${title} for ${user}`)

    delete this.state.rooms[title]
    this.leaveRoom(room.vgroupid)
    this.saveState()

    this.sendToUser(user, `Successfully delisted room ${title}`)
  }

  add(msg, args) {
    const {sender, vgroupid, receiver} = msg
    const username = args[0]
    let room

    if (receiver) {
      this.sendToUser(sender, 'Error: This command only works in rooms')
      return
    }

    if (!username) {
      this.send(vgroupid, 'You must supply a username to add to the room, e.g. `/add bob@example.com`')
      return
    }

    try {
      room = this._getRoomByVgroupId(vgroupid)
    } catch (error) {
      this.send(vgroupid, `Error: ${error.message}`)
      return
    }

    if (!room.isModerator(sender)) {
      this.send(vgroupid, 'You must be a moderator of this room to add a user')
      return
    }

    if (room.isMember(username)) {
      this.send(vgroupid, `${username} is already a member of this room`)
      return
    }

    console.log(`Adding ${username} to ${room.title} at the request of ${sender}`)
    this.updateRoom(vgroupid, { members: [username] })
    this.state.rooms[room.title].members.push(username)
  }

  loadState() {
    try {
      let data = this.brain.get(this.statePath)
      if (data) {
        console.debug('Loaded state from brain', data)
        const state = JSON.parse(data)

        for (const [title, room] of Object.entries(state.rooms)) {
          state.rooms[title] = new Room(title, room.vgroupid, room.owner, room.visibility, room.created, room.lastUpdated)
        }

        this.state = state
      }
    } catch (error) {
      console.log('Error loading saved state:', error)
    }
  }

  saveState() {
    const state = JSON.stringify(this.state)
    console.debug(`Saving state: ${state}`)
    this.brain.set(this.statePath, state)
  }
}

module.exports = RoomBot
