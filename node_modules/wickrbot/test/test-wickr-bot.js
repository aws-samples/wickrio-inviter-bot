const expect = require('chai').expect
const sinon = require('sinon')

const FakeWickr = require('./fakes/wickr')
const WickrBot = require('../lib/bot')

describe('wickr-bot', function() {
  beforeEach(function() {
    this.wickr = new FakeWickr()
  })

  it('instantiates without issue', function() {
    let bot = new WickrBot(this.wickr, 'foo')

    expect(bot.username).to.equal('foo')
  })

  it('starts', function() {
    sinon.spy(this.wickr, 'clientInit')
    let bot = new WickrBot(this.wickr, 'foo')
    bot.start()
    expect(this.wickr.clientInit.calledWith('foo')).to.be.true
  })

  it('creates a listener and calls its handler on a message', function() {
    let fakeMsg = '{"msgtype": 1000, "message": "/foo@fake-bot bar baz"}'
    let spyFn = sinon.spy()
    let bot = new WickrBot(this.wickr, 'foo')

    bot.listen('foo', spyFn)
    bot.handleMessage()(fakeMsg)

    expect(spyFn.calledWith(JSON.parse(fakeMsg), ['bar', 'baz'])).to.be.true
  })

  describe('#handleMessage', function() {
    it('catches errors thrown in handlers', function() {
      let fakeMsg = '{"msgtype": 1000, "message": "/foo@fake-bot"}'
      let fakeFn = sinon.fake.throws(new Error('plz catch me'))
      let bot = new WickrBot(this.wickr, 'foo')

      bot.listen('foo', fakeFn)
      bot.handleMessage()(fakeMsg)

      expect(fakeFn.called).to.be.true
    })

    it('ignores messages which do not contain commands', function() {
      let fakeMsg = '{"msgtype": 1000, "message": "no command here"}'
      let bot = new WickrBot(this.wickr, 'foo')

      bot.handleMessage()(fakeMsg)
    })
  })

  describe('#sendHelp', function() {
    it('is registered as a default handler', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      expect('help' in bot.handlers).to.be.true
      expect(typeof bot.handlers['help'].fn).to.equal('function')
    })

    it('sends a list of available commands', function() {
      let expectedMsg = 'Available commands:\n - foo: flub a wixby in the marzipan\n - bar\n - baz'

      let bot = new WickrBot(this.wickr, 'foo')
      bot.listen('foo', () => {}, {description: 'flub a wixby in the marzipan'})
      bot.listen('bar', () => {})
      bot.listen('baz', () => {})
      bot.listen('secretCommand', () => {}, {hidden: true})

      bot.send = sinon.spy()
      bot.sendHelp({vgroupid: 'deadbeef123'})

      expect(bot.send.calledWith('deadbeef123', expectedMsg)).to.be.true
    })

    it('includes helpText if provided', function() {
      let expectedMsg = 'Hey kid I\'m a bot\nTry these commands out.\n\nAvailable commands:\n - foo: flub a wixby in the marzipan\n - bar\n - baz'

      let bot = new WickrBot(this.wickr, 'foo')
      bot.helpText = 'Hey kid I\'m a bot\nTry these commands out.'
      bot.listen('foo', () => {}, {description: 'flub a wixby in the marzipan'})
      bot.listen('bar', () => {})
      bot.listen('baz', () => {})

      bot.send = sinon.spy()
      bot.sendHelp({vgroupid: 'deadbeef123'})

      expect(bot.send.calledWith('deadbeef123', expectedMsg)).to.be.true
    })
  })

  describe('#_getUsername', function() {
    it('is not called when a username is provided', function() {
      let spyFn = sinon.spy(WickrBot.prototype, '_getUsername')
      let bot = new WickrBot(this.wickr, 'foo')
      expect(spyFn.called).to.be.false
      expect(bot.username).to.equal('foo')
    })

    it('reads a username from process.argv[2]', function() {
      process.argv = ['node', 'index.js', 'thebotname']
      let bot = new WickrBot(this.wickr)
      expect(bot.username).to.equal('thebotname')
    })

    it('throws an error when a username is not found', function() {
      process.argv = []
      let fn = () => new WickrBot(this.wickr)
      expect(fn).to.throw(/Username not found/)
    })
  })

  describe('#_parseMessage', function() {
    it('parses room messages', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      let msg = bot._parseMessage('/list@fake-bot')
      expect(msg).to.eql({command: 'list', args: []})
    })

    it('parses room messages with arguments', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      let msg = bot._parseMessage('/subscribe@fake-bot foo bar baz')
      expect(msg).to.eql({command: 'subscribe', args: ['foo', 'bar', 'baz']})
    })

    it('parses commands with varying spaces in the arguments', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      let msg = bot._parseMessage('/subscribe to  some    thing            wtf  ')
      expect(msg).to.eql({command: 'subscribe', args: ['to', 'some', 'thing', 'wtf']})
    })

    it('parses 1:1 commands', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      let msg = bot._parseMessage('/list')
      expect(msg).to.eql({command: 'list', args: []})
    })

    it('parses 1:1 commands with arguments', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      let msg = bot._parseMessage('/subscribe foo bar baz')
      expect(msg).to.eql({command: 'subscribe', args: ['foo', 'bar', 'baz']})
    })

    it('returns null for unrecognized messages', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      let messages = [
        'omg hi becky',
        '¯\\_(ツ)_/¯',
        '//ohai',
        '```\n/foo bar',
        'eicaighooduuh5uwuy7Die0quies4ahsh6Goiyung8cae9Poopheemoyae9Ni2',
        'bob@example.com',
      ]

      messages.forEach(m => {
        let msg = bot._parseMessage(m)
        expect(msg).to.be.null
      })
    })
  })

  describe('#getRooms', function() {
    it('returns a JSON object', function() {
      let fakeResp = `{
				"rooms": [{
					"description": "Room description",
					"masters": [{ "name" : "username001" }],
					"members": [
						{ "name" : "username001" },
						{ "name" : "username002" }
					],
					"title": "Room Title",
					"ttl": "7776000",
					"bor": "0",
					"vgroupid": "S00bf0ca3169bb9e7c3eba13b767bd10fcc8f41a3e34e5c54dab8bflkjdfde"
				}]
			}`
      this.wickr.cmdGetRooms = sinon.fake.returns(fakeResp)
      let bot = new WickrBot(this.wickr, 'foo')
      expect(bot.getRooms().rooms[0].title).to.equal('Room Title')
    })
  })

  describe('#getRoomIDs', function() {
    it('returns a list of vgroupids', function() {
      let fakeResp = `{
				"rooms": [
					{
						"description": "Room description",
						"masters": [{ "name" : "username001" }],
						"members": [
							{ "name" : "username001" },
							{ "name" : "username002" }
						],
						"title": "Room Title",
						"ttl": "7776000",
						"bor": "0",
						"vgroupid": "S00bf0ca3169bb9e7c3eba13b767bd10fcc8f41a3e34e5c54dab8bflkjdfde"
					},
					{
						"description": "Room description",
						"masters": [{ "name" : "username001" }],
						"members": [
							{ "name" : "username001" },
							{ "name" : "username002" }
						],
						"title": "Room Title",
						"ttl": "7776000",
						"bor": "0",
						"vgroupid": "IePheijaedookei6eeGuchoo4ahh7ahkaevah7ahBeegh7Xe3toh7aijohmobi"
					},
					{
						"description": "Room description",
						"masters": [{ "name" : "username001" }],
						"members": [
							{ "name" : "username001" },
							{ "name" : "username002" }
						],
						"title": "Room Title",
						"ttl": "7776000",
						"bor": "0",
						"vgroupid": "jaech0aepoo5en3meebaiPheezie8QuiiWi8aegal2eecae1kahs5veughoh9o"
					}
				]
			}`
      this.wickr.cmdGetRooms = sinon.fake.returns(fakeResp)
      let bot = new WickrBot(this.wickr, 'foo')
      expect(bot.getRoomIDs()).to.eql([
        'S00bf0ca3169bb9e7c3eba13b767bd10fcc8f41a3e34e5c54dab8bflkjdfde',
        'IePheijaedookei6eeGuchoo4ahh7ahkaevah7ahBeegh7Xe3toh7aijohmobi',
        'jaech0aepoo5en3meebaiPheezie8QuiiWi8aegal2eecae1kahs5veughoh9o',
      ])
    })
  })

  describe('#listen', function() {
    it('registers new handlers', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      bot.listen('bar', (msg) => console.log(msg))
      expect('bar' in bot.handlers).to.be.true
    })
  })

  describe('#sendToUser', function() {
    it('sends to a single user', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdSend1to1Message')

      bot.sendToUser('alice', 'ohai!')
      sinon.assert.calledOnceWithExactly(
        this.wickr.cmdSend1to1Message,
        ['alice'], 'ohai!', '', '', '', [], '',
      )
    })

    it('sends to multiple users', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdSend1to1Message')

      bot.sendToUser(['alice', 'bob', 'chris', 'dave'], 'ohai!')
      sinon.assert.calledOnceWithExactly(
        this.wickr.cmdSend1to1Message,
        ['alice', 'bob', 'chris', 'dave'],
        'ohai!',
        '', '', '', [], '',
      )
    })

    it('sends a message to a user with metadata', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdSend1to1Message')

      const meta = {
        buttons: [
          {
            type: 'message',
            text: 'Click Me',
            message: '/action',
          },
        ],
      }

      bot.sendToUser(['alice', 'bob', 'chris', 'dave'], 'ohai!', { meta })
      sinon.assert.calledOnceWithExactly(
        this.wickr.cmdSend1to1Message,
        ['alice', 'bob', 'chris', 'dave'],
        'ohai!',
        '', '', '', [], JSON.stringify(meta),
      )
    })
  })

  describe('#send', function() {
    it('sends a message to a room', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdSendRoomMessage')

      bot.send('Sfakevgroupid', 'ohai!')
      sinon.assert.calledOnceWithExactly(
        this.wickr.cmdSendRoomMessage,
        'Sfakevgroupid', 'ohai!', '', '', '', [], '',
      )
    })

    it('sends a message to a room with metadata', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdSendRoomMessage')

      const meta = {
        buttons: [
          {
            type: 'message',
            text: 'Click Me',
            message: '/action',
          },
        ],
      }

      bot.send('Sfakevgroupid', 'ohai!', { meta })
      sinon.assert.calledOnceWithExactly(
        this.wickr.cmdSendRoomMessage,
        'Sfakevgroupid',
        'ohai!',
        '', '', '', [], JSON.stringify(meta),
      )
    })
  })

  describe('#createRoom', function() {
    it('creates a new room with a list of users', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdAddRoom')
      bot.createRoom(['alice', 'bob', 'chris', 'dave'], ['alice', 'dave'], 'FooRoom', 'BarTitle')
      sinon.assert.calledWith(this.wickr.cmdAddRoom,
        ['alice', 'bob', 'chris', 'dave'], ['alice', 'dave'], 'FooRoom', 'BarTitle',
      )
    })

    it('creates a new room with a single user', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdAddRoom')
      bot.createRoom('dave', 'dave', 'FooRoom', 'BarTitle')
      sinon.assert.calledWith(this.wickr.cmdAddRoom,
        ['dave'], ['dave'], 'FooRoom', 'BarTitle',
      )
    })
  })

  describe('#deleteRoom', function() {
    it('calls the delete room function', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdDeleteRoom')

      bot.deleteRoom('Sfakevgroupid')
      sinon.assert.calledWith(this.wickr.cmdDeleteRoom, 'Sfakevgroupid')
    })
  })

  describe('#modifyRoom', function() {
    it('modifies a room', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdModifyRoom')
      bot.modifyRoom('fakevgroupid', ['alice', 'bob', 'chris', 'dave'], ['alice', 'dave'], 'FooRoom', 'BarTitle')

      expect(this.wickr.cmdModifyRoom.called).to.be.true
      sinon.assert.calledWith(this.wickr.cmdModifyRoom,
        'fakevgroupid', ['alice', 'bob', 'chris', 'dave'], ['alice', 'dave'], 'FooRoom', 'BarTitle',
      )
    })
  })

  describe('#_formatRoomStateForUpdate', function() {
    it('properly formats a room state response', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      let state = {...require('./fixtures/get-room-response.json')}
      let expected = {
        'description': 'Room description',
        'moderators': ['alice'],
        'members': ['alice', 'bob'],
        'title': 'Room Title',
        'ttl': '-1',
        'vgroupid': 'Sfakevgroupid',
      }
      let result = bot._formatRoomStateForUpdate(state)
      expect(result).to.eql(expected)
    })
  })

  describe('#updateRoom', function() {
    it('updates a room by getting and then setting the state', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.stub(bot, 'getRoom')
      bot.getRoom.returns({...require('./fixtures/get-room-response.json')})
      sinon.spy(bot, 'modifyRoom')
      bot.updateRoom('Sfakevgroupid', { moderators: ['alice', 'bob' ] })

      expect(bot.getRoom.called).to.be.true
      expect(bot.modifyRoom.called).to.be.true
      sinon.assert.calledWith(bot.modifyRoom,
        'Sfakevgroupid', ['alice', 'bob'], ['alice', 'bob'], 'Room Title', 'Room description',
      )
    })

    it('properly merges new users', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.stub(bot, 'getRoom')
      bot.getRoom.returns({...require('./fixtures/get-room-response.json')})
      sinon.spy(bot, 'modifyRoom')
      bot.updateRoom('Sfakevgroupid', { members: ['chris', 'dave'] })

      expect(bot.getRoom.called).to.be.true
      expect(bot.modifyRoom.called).to.be.true
      sinon.assert.calledWith(bot.modifyRoom,
        'Sfakevgroupid', ['alice', 'bob', 'chris', 'dave'], ['alice'], 'Room Title', 'Room description',
      )
    })
  })

  describe('#leaveRoom', function() {
    it('calls cmdLeaveRoom', function() {
      let bot = new WickrBot(this.wickr, 'foo')
      sinon.spy(this.wickr, 'cmdLeaveRoom')

      bot.leaveRoom('Sfakevgroupid')
      expect(this.wickr.cmdLeaveRoom.calledWith('Sfakevgroupid'))
    })
  })
})
