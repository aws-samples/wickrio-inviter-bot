const expect = require('chai').expect
const sinon = require('sinon')

const WickrBrain = require('../lib/brain')
const FakeWickr = require('./fakes/wickr')

describe('brain', function() {
  beforeEach(function() {
    this.wickr = new FakeWickr()
  })

  it('instantiates without issue', function() {
    new WickrBrain(this.wickr)
  })

  describe('#get', function() {
    it('returns a value from the k/v store', function() {
      this.wickr.cmdGetKeyValue = sinon.fake.returns('42')
      let brain = new WickrBrain(this.wickr)

      expect(brain.get('foo')).to.equal('42')
    })

    it('returns a json string from the k/v store', function() {
      let fakeResp = '{"foo": "bar", "baz": "eyJhIjoxMjMsImIiOlsiYmFyIiwiYmF6Il19"}'
      this.wickr.cmdGetKeyValue = sinon.fake.returns(fakeResp)
      let brain = new WickrBrain(this.wickr)

      expect(brain.get('foo')).to.eql('{"foo": "bar", "baz": "eyJhIjoxMjMsImIiOlsiYmFyIiwiYmF6Il19"}')
    })

    it('returns null for unset values', function () {
      this.wickr.cmdGetKeyValue = sinon.fake.throws(new Error('key not found'))
      let brain = new WickrBrain(this.wickr)

      expect(brain.get('foo')).to.equal(null)
    })
  })

  describe('#set', function() {
    it('calls cmdAddKeyValue', function() {
      this.wickr.cmdAddKeyValue = sinon.spy()
      let brain = new WickrBrain(this.wickr)

      brain.set('foo', 'where da kubernetes at')
      expect(this.wickr.cmdAddKeyValue.calledWith('foo', 'where da kubernetes at')).to.be.true
    })
  })
})
