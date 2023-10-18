// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
module.exports = class Room {
  visibility = 'private'

  constructor(title, vgroupid, owner, visibility, created, lastUpdated) {
    this.title = title
    this.vgroupid = vgroupid
    this.owner = owner
    this.description = ''
    this.created = created || Date.now()
    this.lastUpdated = lastUpdated || Date.now()
    this.members = []
    this.moderators = []

    // TODO: validate visibility
    this.visibility = visibility || this.visibility
  }

  /**
   * fromGetRoomResponse
   * @param {object} resp   The response body from cmdGetRoom
   * @returns Room
   */
  static fromGetRoomResponse(resp) {
    const room = new Room(resp.title, resp.vgroupid, undefined, 'hidden')
    room.members = resp.members.map((m) => m.name)
    room.moderators = resp.masters.map((m) => m.name)

    return room
  }

  toString() {
    return JSON.stringify(this, null, 2)
  }

  isOwner(username) {
    return username === this.owner
  }

  isModerator(username) {
    return this.moderators.includes(username)
  }

  isMember(username) {
    return this.members.includes(username)
  }
}
