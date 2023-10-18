# Wickr Room Bot

A bot for creating and displaying shared rooms on Wickr.

## Installation

See the WickrIO [Getting Started Guide](https://wickrinc.github.io/wickrio-docs/#wickr-io-getting-started).

## Usage

Room Bot understands the following commands:

 - `/help` - Prints a help message with all available commands
 - `/list` - Lists all rooms managed by the Room Bot
 - `/create` - Creates a new managed room
 - `/join` - Joins a managed room
 - `/visibility` - Set the visibility of this room

### Visibility

Rooms managed by the Room Bot have a `visibility` setting which controls how users can find and join the room.

 1. `public` - Any user can list or join the room. If the bot is not a moderator of the room, an invite request will be sent instead.
 2. `private` - The room is publicly listed, but users must be invited
 3. `hidden` - The room is unlisted and invite-only

## Development

Originally developed by [dwickr](https://github.com/dwickr/).

### Building

Run `make` to create a new `software.tar.gz` package, which can be installed as a WickrIO Custom Integration. See the [WickrIO docs](https://wickrinc.github.io/wickrio-docs/#developing-integrations-creating-an-integration-locally) for more details.

## Security

Ensure your bot is not available to users outside of your network. We highly recommend disabling Wickr Federation for bots by making a security group with that feature disabled: https://docs.aws.amazon.com/wickr/latest/adminguide/security-groups.html#edit-security-group.

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
