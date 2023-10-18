class FakeWickr {
  clientInit() {}
  cmdAddKeyValue() {}
  cmdClearAllKeyValues() {}
  cmdDeleteKeyValue() {}
  cmdGetKeyValue() {
    throw new Error('key not found')
  }
  cmdAddRoom() {}
  cmdLeaveRoom() {}
  cmdDeleteRoom() {}
  cmdModifyRoom() {}
  cmdGetRoom() { return '{ "masters": [], "members": [] }' }
  cmdGetRooms() { return '{}' }
  cmdStartAsyncRecvMessages() {}
  cmdSendRoomMessage() {}
  cmdSend1to1Message() {}
  isConnected() {}
}

module.exports = FakeWickr
