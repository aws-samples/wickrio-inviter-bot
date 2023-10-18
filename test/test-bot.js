const expect = require('chai').expect
const sinon = require('sinon')

const FakeWickr = require('./fakes/wickr')
const RoomBot = require('../lib/bot')
const Room = require('../lib/room')

describe('bot', function() {
  beforeEach(function() {
    this.bot = new RoomBot(new FakeWickr(), 'rbot')
    this.bot.state.rooms['Fake Room'] = new Room('Fake Room', 'Sfakevgroupid', 'alice', 'public')
    this.bot.state.rooms['Fake Room'].moderators = ['alice']
    this.bot.state.rooms['Fake Room'].members = ['alice']
  })

  it('instantiates without issue', function() {
    let wickr = new FakeWickr()
    new RoomBot(wickr, 'foo')
  })

  it('registers handlers', function() {
    expect(Object.keys(this.bot.handlers)).to.eql(['help', 'create', 'list', 'join', 'visibility', 'describe', 'delist', 'add'])
  })

  describe('#_getRoomByVgroupId', function() {
    it('returns a room which exists', function() {
      const room = this.bot._getRoomByVgroupId('Sfakevgroupid')
      sinon.assert.match(room, {title: 'Fake Room', vgroupid: 'Sfakevgroupid'})
    })

    it('throws an error when a room does not exist', function() {
      const fn = () => { this.bot._getRoomByVgroupId('Sfakefakevgroupid') }
      expect(fn).to.throw('Unable to find details for room')
    })
  })

  describe('#create', function() {
    it('helps the user out when no arguments are provided', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'createRoom')

      this.bot.create({ sender: 'alice', vgroupid: 'fakevgroupid' }, [])
      sinon.assert.calledOnceWithExactly(
        this.bot.send,
        'fakevgroupid',
        'To create a room, provide the room name with the create command, e.g. `/create Casual Meme Room`',
      )
      sinon.assert.notCalled(this.bot.createRoom)
    })

    it('creates a new room', function() {
      const vgroupid = 'Sfakevgroupid'
      sinon.stub(this.bot, 'createRoom')
      sinon.spy(this.bot, 'send')
      this.bot.createRoom.returns(JSON.stringify({ vgroupid: 'Sfakevgroupid' }))

      this.bot.create({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['Casual', 'Meme', 'Room'])
      sinon.assert.calledOnceWithExactly(
        this.bot.createRoom,
        'alice', 'alice', 'Casual Meme Room',
      )
      sinon.assert.calledOnceWithMatch(
        this.bot.send,
        vgroupid, '🥳 You have started a new room!',
      )
    })

    it('creates a new room but gets a bad response', function() {
      sinon.stub(this.bot, 'createRoom')
      sinon.spy(this.bot, 'send')
      this.bot.createRoom.returns('this ain\'t right')

      this.bot.create({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['Casual', 'Meme', 'Room'])
      sinon.assert.calledOnceWithExactly(
        this.bot.createRoom,
        'alice', 'alice', 'Casual Meme Room',
      )
      sinon.assert.notCalled(this.bot.send)
    })

    it('does not create rooms with conflicting names', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'createRoom')

      this.bot.create({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.calledOnceWithExactly(
        this.bot.send,
        'fakevgroupid',
        'Error: A room with this name already exists',
      )
      sinon.assert.notCalled(this.bot.createRoom)
    })

    it('limits room name lengths', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'createRoom')

      this.bot.create({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['A'.repeat(128)])
      sinon.assert.calledOnceWithExactly(
        this.bot.send,
        'fakevgroupid',
        'Error: Room name is too long',
      )
      sinon.assert.notCalled(this.bot.createRoom)
    })
  })

  describe('#visibility', function() {
    it('sends the visibility to the room when no arguments are provided', function() {
      sinon.spy(this.bot, 'send')

      this.bot.visibility({ vgroupid: 'Sfakevgroupid' }, [])
      sinon.assert.calledOnceWithMatch(this.bot.send, 'Sfakevgroupid', /^The visibility of this room is currently/)
    })

    it('sets the visibility when the sender is a moderator', function() {
      for (const v of ['private', 'hidden', 'public', 'PRiVaTe', 'HIDDEN', 'Public']) {
        this.bot.visibility({ sender: 'alice', vgroupid: 'Sfakevgroupid' }, [v])
        expect(this.bot.state.rooms['Fake Room'].visibility).to.equal(v.toLowerCase())
      }
    })

    it('rejects updates when the sender is not a moderator', function() {
      sinon.spy(this.bot, 'send')

      this.bot.visibility({ sender: 'bob', vgroupid: 'Sfakevgroupid' }, ['private'])
      expect(this.bot.state.rooms['Fake Room'].visibility).to.equal('public')
      sinon.assert.calledOnceWithExactly(this.bot.send, 'Sfakevgroupid', 'Error: You must be a moderator of this room to change the visibility.')
    })

    it('complains about unknown visibilities', function() {
      sinon.spy(this.bot, 'send')

      this.bot.visibility({ vgroupid: 'Sfakevgroupid' }, ['scrumtrulescent'])
      sinon.assert.calledOnceWithExactly(this.bot.send, 'Sfakevgroupid', 'Error: Invalid visibility setting')
    })

    it('errors when it receives an invalid vgroupid', function() {
      sinon.spy(this.bot, 'send')

      this.bot.visibility({ vgroupid: 'Sfakefakevgroupid' }, ['private'])
      sinon.assert.calledOnceWithExactly(this.bot.send, 'Sfakefakevgroupid', 'Error: Unable to find details for room')
    })
  })

  describe('#join', function() {
    it('does not do anything for users already in the room', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.join({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.notCalled(this.bot.send)
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledOnceWithExactly(this.bot.sendToUser, 'alice', 'You are already a member of that room')
    })

    it('returns an error if the room is not found', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.join({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['Non-existent', 'Room'])
      sinon.assert.notCalled(this.bot.send)
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledOnceWithExactly(this.bot.sendToUser, 'alice', 'Error: 404 Room Not Found')
    })

    it('suggests a room name if possible', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.join({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['Drake', 'Room'])
      sinon.assert.notCalled(this.bot.send)
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledOnceWithMatch(this.bot.sendToUser, 'alice', 'Room not found. Did you mean \'Fake Room\'?')
    })

    it('adds a new user to public rooms if the bot is a moderator', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.state.rooms['Fake Room'].moderators = ['alice', 'rbot']
      this.bot.join({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.notCalled(this.bot.send)
      sinon.assert.calledOnceWithExactly(this.bot.updateRoom, 'Sfakevgroupid', { members: ['bob'] })
      sinon.assert.calledOnceWithExactly(this.bot.sendToUser, 'bob', 'You have been successfully added to "Fake Room"')
    })

    it('requests an invite to public rooms if the bot is not a moderator', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.join({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledOnceWithExactly(this.bot.send, 'Sfakevgroupid', '📨 Invite request: user bob has requested to be added to this room')
      sinon.assert.calledOnceWithExactly(this.bot.sendToUser, 'bob', 'An invite request has been sent to "Fake Room"')
    })

    it('requests an invite to private rooms', function() {
      this.bot.state.rooms['Fake Room'].visibility = 'private'
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.join({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledOnceWithExactly(this.bot.send, 'Sfakevgroupid', '📨 Invite request: user bob has requested to be added to this room')
      sinon.assert.calledOnceWithExactly(this.bot.sendToUser, 'bob', 'An invite request has been sent to "Fake Room"')
    })

    it('requests an invite to hidden rooms', function() {
      this.bot.state.rooms['Fake Room'].visibility = 'hidden'
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.join({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledOnceWithExactly(this.bot.send, 'Sfakevgroupid', '📨 Invite request: user bob has requested to be added to this room')
      sinon.assert.calledOnceWithExactly(this.bot.sendToUser, 'bob', 'An invite request has been sent to "Fake Room"')
    })
  })

  describe('#describe', function() {
    it('returns an error if the user is not in the room', function() {
      sinon.spy(this.bot, 'sendToUser')

      this.bot.describe({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.calledWithExactly(this.bot.sendToUser, 'bob', 'You must be a member of a room to describe it')
    })

    it('returns an error if the room is not found', function() {
      sinon.spy(this.bot, 'sendToUser')

      this.bot.describe({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['Non-Existent', 'Room'])
      sinon.assert.calledWithExactly(this.bot.sendToUser, 'bob', 'Error: 404 Room Not Found')
    })

    it('sends the room state', function() {
      sinon.spy(this.bot, 'sendToUser')

      this.bot.describe({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.calledOnceWithMatch(this.bot.sendToUser, 'alice', '"title": "Fake Room"')
    })
  })

  describe('#delist', function() {
    it('returns an error if the user is not a moderator or the owner', function() {
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'leaveRoom')

      this.bot.delist({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.calledWithExactly(this.bot.sendToUser, 'bob', 'You must be a moderator of the room to delist it')
      sinon.assert.notCalled(this.bot.leaveRoom)
      expect(this.bot.state.rooms).to.haveOwnProperty('Fake Room')
    })

    it('returns an error if the room is not found', function() {
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'leaveRoom')

      this.bot.delist({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['Non-Existent', 'Room'])
      sinon.assert.notCalled(this.bot.leaveRoom)
      sinon.assert.calledWithExactly(this.bot.sendToUser, 'bob', 'Error: 404 Room Not Found')
    })

    it('delists a room', function() {
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'leaveRoom')

      this.bot.delist({ sender: 'alice', vgroupid: 'fakevgroupid' }, ['Fake', 'Room'])
      sinon.assert.calledOnceWithExactly(this.bot.leaveRoom, 'Sfakevgroupid')
      sinon.assert.calledOnceWithMatch(this.bot.sendToUser, 'alice', 'Successfully delisted room Fake Room')
      expect(this.bot.state.rooms).to.not.haveOwnProperty('Fake Room')
    })
  })

  describe('#add', function() {
    it('lets a moderator add the user to a current room', function() {
      sinon.spy(this.bot, 'updateRoom')

      this.bot.add({ sender: 'alice', vgroupid: 'Sfakevgroupid' }, ['bob@example.com'])
      sinon.assert.calledOnceWithExactly(this.bot.updateRoom, 'Sfakevgroupid', { members: ['bob@example.com']})
      expect(this.bot.state.rooms['Fake Room'].members).to.include('bob@example.com')
    })

    it('returns an error if the bot cannot find the room', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.add({ sender: 'bob', vgroupid: 'fakevgroupid' }, ['alice@example.com'])
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledWithExactly(this.bot.send, 'fakevgroupid', 'Error: Unable to find details for room')
    })

    it('returns an error if it is a 1:1 message', function() {
      sinon.spy(this.bot, 'sendToUser')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.add({ sender: 'bob', receiver: 'bot', vgroupid: 'fakevgroupid' }, ['alice@example.com'])
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledWithExactly(this.bot.sendToUser, 'bob', 'Error: This command only works in rooms')
    })

    it('returns an error if the requester is not a moderator', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'updateRoom')

      this.bot.add({ sender: 'bob', vgroupid: 'Sfakevgroupid' }, ['alice@example.com'])
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledWithExactly(this.bot.send, 'Sfakevgroupid', 'You must be a moderator of this room to add a user')
    })

    it('returns an error if the user is already in the room', function() {
      sinon.spy(this.bot, 'send')
      sinon.spy(this.bot, 'updateRoom')
      this.bot.state.rooms['Fake Room'].members = ['alice', 'bob@example.com']

      this.bot.add({ sender: 'alice', vgroupid: 'Sfakevgroupid' }, ['bob@example.com'])
      sinon.assert.notCalled(this.bot.updateRoom)
      sinon.assert.calledWithExactly(this.bot.send, 'Sfakevgroupid', 'bob@example.com is already a member of this room')
    })
  })

  describe('#list', function() {
    it('sends a list of rooms to the user', function() {
      this.bot.state.rooms['Fake Private Room'] = new Room('Fake Private Room', 'Sfakevgroupid2', 'alice', 'private')
      this.bot.state.rooms['Fake Hidden Room'] = new Room('Fake Hidden Room', 'Sfakevgroupid3', 'alice', 'hidden')
      const expected = `*Room List*
• Fake Room
• Fake Private Room (private)`

      sinon.spy(this.bot, 'sendToUser')
      this.bot.list({ sender: 'bob' })

      sinon.assert.calledOnceWithExactly(this.bot.sendToUser, 'bob', expected)
    })
  })
})
