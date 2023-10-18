// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const wickr = require('wickrio_addon')

const RoomBot = require('./lib/bot')

async function main() {
  let bot = new RoomBot(wickr)
  bot.start()
}

// eslint-disable-next-line no-unused-vars
main().then(result => {}).catch(e => { console.error(e); process.exit(1) })
