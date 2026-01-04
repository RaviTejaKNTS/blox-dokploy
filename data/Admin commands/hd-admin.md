# HD Admin Commands
Source: https://github.com/nanoblox/hd-admin (commit e1c4e20071024a81963be85d6c4c7111882c7581, accessed 2026-01-02); https://hdadmin.fandom.com/wiki/Commands (accessed 2026-01-02); https://github.com/nanoblox/hd-admin (command order from source modules, accessed 2026-01-02)
Default Prefix: ;
Generated: 2026-01-02

## Ability
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Spin |  |  | Player, Number | Makes the player spin at a specific speed until turned off or upon death. |
| 2 | ForceField | FF |  | Player | Gives the player a cosmetic forcefield. |
| 3 | Fire |  |  | Player | Makes a player engulf in flame particles. |
| 4 | Smoke |  |  | Player | Makes some appear around the player. |
| 5 | Sparkles |  |  | Player | Makes sparkle particles appear around a player. |
| 6 | Sit |  |  | Player | Makes a player imitate behaviour like that upon stepping on a tripblock. |
| 7 | Jump |  |  | Player | Makes a player forcefully jump. |
| 8 | NightVision | NV |  | Player | Makes the selected player see other players via a red outline around them. (Basically Xray to see other players and their users.) |
| 9 | Respawn | Res |  | Player | Resets a player and put them back at their spawn point. |
| 10 | Warp |  |  | Player | Plays a short warping animation on a player's screen. |
| 11 | Blur |  |  | Player, Number | Blurs the player's screen, customisable via the number value. |
| 12 | Anchor | Freeze |  | Player |  |
| 13 | Name | FakeName |  | Player, Text | Changes the name above a player's head. |
| 14 | HideName |  | ShowName | Player | Hides the name above a player's head. |

## Ban
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Ban |  |  | Player | Makes the ban menu pop-up, varying on permissions one can ban them permanently or only temporarily. |
| 2 | TimeBan |  |  | Player | Bans a user for a specified amount of time. |

## Building
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | BuildingTools | Btools |  | Player | Gives a specific player the F3X Btools. |
| 2 | Clone |  |  | Player | Clones a player's model. |

## Bundle
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Bundle |  |  | Player | Equips a specific bundle for the player. |
| 2 | Buffify |  |  | Player | The same as /buff from Booster. |
| 3 | Wormify |  |  | Player | The same as /worm from Booster. |
| 4 | Chibify |  |  | Player | The same as /chibi from Booster. |
| 5 | Plushify |  |  | Player | The same as /plush from Booster. |
| 6 | Freakify |  |  | Player | The same as /freak from Booster. |
| 7 | Frogify |  |  | Player |  |
| 8 | Spongify |  |  | Player | The same as /sponge from Booster. |
| 9 | Bigify |  |  | Player | Equips a fat bundle for the player. |
| 10 | Creepify |  |  | Player | Equips a bundle which makes the player look like they were taken out of a horror movie. |
| 11 | Dinofy |  |  | Player | The same as /dino from Booster. |
| 12 | Fatify |  |  | Player |  |

## Character
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Size |  |  | Player, Scale |  |
| 2 | HeadSize | HeadScale |  | Player, Scale | Changes the player's headsize. |
| 3 | BigHead | BHead, LargeHead |  | Player | Makes the player have a bigger head. |
| 4 | SmallHead |  |  | Player | Makes the player have.. Well a smaller head. |
| 5 | Dwarf |  |  | Player | Makes the player shorter but gives them a big head. |
| 6 | GiantDwarf |  |  | Player | Makes the player have a disproportionately big head to the rest of their body. Makes them bigger too. |
| 7 | Squash | Flat, Flatten |  | Player | Squishes the player down to a disk. |
| 8 | Width | WScale, WidthScale |  | Player, Scale | Changes a player's width. |
| 9 | Fat |  |  | Player | Also self-explanatory. |
| 10 | Thin | Skinny |  | Player | Very self-explanatory. |
| 11 | Face |  |  | Player, Integer | Changes the player's face via a catalog ID or a texture ID. |
| 12 | Head |  |  | Player, Integer | Changes a player's head to a dynamic/bundle one via the ID. |
| 13 | PotatoHead | PHead |  | Player | Turns a player's head into a potato. |
| 14 | BodyTypeScale | BTScale |  | Player, Scale | Changes the proportions variable of Roblox avatars. |
| 15 | Depth | DScale, DepthScale |  | Player, Scale | Changes the player's avatar's depth. |
| 16 | Height | HScale, HeightScale |  | Player, Scale | Changes the height of a player's avatar. |
| 17 | HipHeight | Hip |  | Player, Scale | Changes the vertical location of the Humanoid Root. |
| 18 | Shirt |  |  | Player, Integer | Makes the player wear a specific classic shirt from the catalog. |
| 19 | Pants |  |  | Player, Integer | Makes the player wear specific classic pants from the catalog. |
| 20 | Accessory | Hair, Hat |  | Player, Integer | Gives the player an accessory from the catalog based on the ID given. |
| 21 | ClearHats | ClrHats, ClearAccessories, ClrAccessories, RemoveHats, RemoveAccessories |  | Player | Gets rid of all of the player's accessories. |
| 22 | Char | Character, Become |  | OptionalPlayer, AnyUser | Turns a player into another player. (e: ;char me Roblox) |
| 23 | View | Watch, Spectate |  | SinglePlayer | Makes the user spectate another player. |

## Chat
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | ChatTag |  |  | Player | Sets a tag before the user when they speak in chat. |
| 2 | ChatTagColor |  |  | Player | Changes the colour of the above mentioned. |
| 3 | ChatName |  |  | Player | Changes your chat name based on a string of text (No spaces) and a specified colour set in the settings. (;chatname me Person Red) |
| 4 | ChatNameColor |  |  | Player | Same as before, however this one just changes the colour of somebody's user. |
| 5 | SystemMessage | SystemChat, SystemChat, SC |  | Text |  |

## Control
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Control |  |  | Player | Controls a specific player, makes the chatHijacker GUI automatically pop up on the screen of the possessor. |
| 2 | Chat |  |  | Player | Makes a specific player say something in the chat by force. (If they're on the server, clicking on the user redirects to /w to them too.) |
| 3 | ChatHijacker |  |  | Player | Gives a specific player the chatHijacker tool, basically the same as ;chat but with a GUI to use it. |

## Emote
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Emotes |  |  | Player |  |
| 2 | Emote |  |  | Player |  |
| 3 | Aura |  |  | Player |  |
| 4 | Helicopter |  |  | Player |  |
| 5 | Plane |  |  | Player |  |
| 6 | Tank |  |  | Player |  |
| 7 | Car |  |  | Player |  |
| 8 | RatDance |  |  | Player |  |
| 9 | CuteSit |  |  | Player |  |
| 10 | FakeDeath |  |  | Player |  |
| 11 | Hide |  |  | Player |  |
| 12 | Box |  |  | Player |  |
| 13 | Dog |  |  | Player |  |
| 14 | Worm |  |  | Player |  |
| 15 | TakeTheL |  |  | Player |  |
| 16 | FryDance |  |  | Player |  |
| 17 | Phase |  |  | Player |  |

## Gear
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Gears |  |  | Player |  |

## Material
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Reflect | Ref, Shiny, Reflectance |  | Player, Number | Changes the player's reflectance based on number. |
| 2 | Material | Mat, Surface |  | Player, Material | Changes the player's material. (e: ;material MiIoshiee Bricks) |
| 3 | Paint | Color, Colour |  | Player, Color | Changes the player's colour based on the Settings presets. |
| 4 | Transparency | Trans |  | Player, Number | Changes the player's transparency based on the number. |
| 5 | Invisible | Invis | Visible, Vis | Player | Makes a player invisible. |

## Moderate
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Mute |  |  | Player | Mutes a player and makes their chat icon completely disappear. (Undoable.) |
| 2 | Kick |  |  | Player | Kicks a player with a specific kick message. |
| 3 | Punish |  |  | Player | Makes the player invisible, freezes them in place and keeps them in that state until it gets undone. (Resetting won't work.) |
| 4 | Follow |  |  | AnyUser | If they're on the game this is used in, it allows the user to follow the target into the server they are playing. |

## Notifier 1
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Hint | H |  | OptionalPlayers, OptionalColor, Text | Displays a hint in a specific colour. (e: ;hbk Hi! - Would display a hint with black text.) |
| 2 | Message | M, Announce, Broadcast, Announcement |  | OptionalPlayers, OptionalColor, Text | Displays a serverwide message using a specific shortcut for a colour. (Example for blue: ;mb Message) |
| 3 | Notice | Not |  | OptionalPlayers, Text | Displays a notice to a specific player. (Sounds and such are customisable.) |

## Notifier 2
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | PrivateMessage | PM |  | Player, Text | Gives a player a pop-up which also displays the user they received it from, no other players see it. |
| 2 | ServerMessage | SM, SMessage |  | OptionalPlayers, OptionalColor, Text | Displays a message to the server from the Server. (Executor of the command is not displayed.) |
| 3 | ServerHint | SH, SHint |  | OptionalPlayers, OptionalColor, Text | Displays a hint to the server without providing the person who did it. |
| 4 | Countdown | CountdownHint, Countdown1 |  | OptionalPlayers, OptionalColor, CountdownTime | Displays a countdown (In seconds) which shows itself at the top of the screen. |
| 5 | Countdown2 | CountdownMessage |  | OptionalPlayers, OptionalColor, Number | Also displays in seconds, however this one appears as a box similar to Notice. |
| 6 | Alert | Warn |  | OptionalPlayers, Text | Displays an alert which makes sounds every once in a while. (Also customisable.) |
| 7 | Vote | Poll |  | OptionalPlayers, Text, Fields | Makes a vote menu pop up which shows only on the specific server it's used in. |

## Role
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Role | GiveRole | TakeRole | Player |  |

## Troll
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Ice |  | Thaw | Player | Puts the player in a block of ice. |
| 2 | Jail | JailCell, JC |  | Player | Puts a specific player into a jail model which they can't reset out of. |
| 3 | LaserEyes | LE, LazerEyes, LasorEyes, LazorEyes |  | Player, Color | Exported and reworked from Donor commands. |
| 4 | Explode |  |  | Player | Explodes a player. |
| 5 | Fling |  |  | Player | Flings a player into the skies. |

## Utility
| Order | Command | Aliases | Undo Aliases | Args | Description |
| --- | --- | --- | --- | --- | --- |
| 1 | Reset | Refresh, Re |  | Player | Resets a player and puts them back where they stood when executing. |

## Booster
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | Bundle |  | Player | Equips a specific bundle for the player. |
| 2 | /Shake |  | Player |  |
| 3 | /Dolphin | /Dance0 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 4 | /Dorky | /Dance1 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 5 | /Monkey | /Dance2 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 6 | /Floss | /Dance3 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 7 | /AroundTown | /Dance4 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 8 | /TouchDance | /Dance5 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 9 | /HotToGo | /Dance6 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 10 | /FancyFeet | /Dance7 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 11 | /Bouncy | /Dance8 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 12 | /TopRock | /Dance9 | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 13 | /Dance |  | Player | A wide arrangement of dances one can do, from 0-9 one can pick a specific one. (e: /dance7) |
| 14 | /Emota |  | Player | Broken. |
| 15 | /Cheer |  | Player | Plays a short cheering animation. |
| 16 | /Backflip |  | Player | Makes the player backflip. |
| 17 | /Salute |  | Player | Plays a Roblox emote under the same name. |
| 18 | /Shy |  | Player | Plays a Roblox emote under the same name. |
| 19 | /Sad |  | Player | Plays an animation where the player shows they're upset. |
| 20 | /Bored |  | Player | Plays a Roblox emote under the same name. |
| 21 | /Flex |  | Player | Makes the player flex their arm. |
| 22 | /Brag |  | Player |  |
| 23 | /Tpose |  | Player | Makes the user form the letter t. |
| 24 | /Vpose |  | Player | Makes the user form the letter v. |
| 25 | /Ypose |  | Player | Makes the user form the letter y. |
| 26 | /ZombieHands |  | Player | The user tries to imitate a zombie stretching their arms forward and stumbling in place. |
| 27 | /Roar |  | Player |  |
| 28 | /HandBlast |  | Player | Makes the player put their hands together and tries to imitate an anime style blast. |
| 29 | /JumpingJacks |  | Player | The user starts doing jumping jacks. |
| 30 | /GuitarAir |  | Player | Makes the user play an imaginary guitar. |
| 31 | /Flare |  | Player | Does a little breakdance then stops. |
| 32 | /FaceFrame |  | Player | Makes the player do a little pose. |
| 33 | /Samba |  | Player | Self-explanatory dance command. |
| 34 | /Happy |  | Player | Cheerful dance. |
| 35 | /Buff |  | Player | Should be pretty self-explanatory because of the above. |
| 36 | /Snowman |  | Player | Equips a snowman bundle. |
| 37 | /Wormy |  | Player |  |
| 38 | /Skeleton |  | Player | Equips a skeleton bundle. |
| 39 | /Chibi |  | Player | Turns the character bundle to Chibi Girl. (Available for VIP too under ;chibify) |
| 40 | /Plush |  | Player | Uses the plush bundle. |
| 41 | /Chunky |  | Player | Makes the character fat. |
| 42 | /Crab |  | Player | Equips a crab bundle. |
| 43 | /Spider |  | Player | Equips a spider bundle. |
| 44 | /Frog |  | Player | Equips a frog bundle. |
| 45 | /Rat |  | Player | The player turns into a rat. |
| 46 | /Hamster |  | Player | Turns the player into a hamster. |
| 47 | /Capybara |  | Player | Equips a capybara bundle. |
| 48 | /Penguin |  | Player |  |
| 49 | /Duck |  | Player | Equips a duck bundle. |
| 50 | /Goose |  | Player | The player turns into a goose. |
| 51 | /Sponge |  | Player | Turns the player into a sea sponge creature. |
| 52 | /Freak |  | Player |  |
| 53 | /Reset |  | Player | Resets back character appearance to your avatar. |
