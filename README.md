# Head-Butt-Alotl

A small 3D browser game where an axolotl headbutts aliens in a pond, eats worms and rare steak for XP, and buys upgrades.

## Run

```bash
npm start
```

Then open <http://localhost:3002>.

To run this mobile fork next to the desktop version:

```bash
$env:PORT=3003; npm start
```

Then open <http://localhost:3003>.

## Controls

Default controls are configurable in the Options menu.
- Move: WASD
- Aim up/down with mouse to change swim height while moving
- Sprint: Left mouse
- Upgrade menu: U
- Pause/menu: Escape

## Mobile Controls

- Move: left thumbstick
- Look/swim height: drag on the right side of the screen
- Boost: hold BOOST
- Pause: II
- Upgrades: C

## Features

- Start menu with New Game, Continue, Options
- First-person 3D pond scene
- Worm and steak pickups
- XP and currency progression
- Character upgrade menu
- Persistent save via localStorage
- Options for keybinds, sound, graphics
