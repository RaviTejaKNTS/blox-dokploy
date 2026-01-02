# Kohl's Admin Commands (Infinite)
Source: https://github.com/kohls-admin/kohls-admin (commit f5ebabc9aa0a5e4a6e9671d9f5868bab057592af, accessed 2026-01-02)
Default Prefixes: ;, :
Generated: 2026-01-02

## Administration
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| announce |  | Message | Shows a message to everyone in the game, saves and shows to new users until it has been cleared. |
| gear |  | Player(s), AssetId | Gives one or more player(s) a gear. |
| insert | ins | AssetId | Inserts a model at the player's position. |
| place | pl | Player(s), PlaceId | Teleports one or more player(s) to a place. |
| removemember | removepermissions, removeroles | Members(s) | Removes all roles and permissions from one or more member(s). |
| role | rank | Users(s), Roles(s), Temporary | Assigns a role(s) to one or more user(s). |
| serverlock | slock |  | Locks the server preventing new players from joining. |
| temprole | temprank | Users(s), Roles(s) | Assigns a temporary role(s) to one or more user(s). |
| unannounce | clearannounce |  | Removes the pinned announcement. |
| unrole | removerole, unrank, removerank | Member(s), Roles(s) | Removes one or more role(s) from one or more member(s). |
| unserverlock | unslock |  | Unlocks the server allowing new players to join again. |

## Creator
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| clearlogs | clrlogs |  | Removes all Kohl's Admin server logs. |
| hidelogs | unhidelogs | Player(s) | Hides the Kohl's Admin logs of one or more player(s). |
| localscript | ls | Player(s), Source | Runs a script locally for one or more player(s). |
| script | s, loadstring | Source | Runs a script. |

## Environment
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| airdensity |  | Density | Changes the air density used in aerodynamic forces model. |
| ambient |  | Hue | Changes the color of Lighting.Ambient. |
| atmosphere |  | Density, Offset, Color, DecayColor, Glare, Haze | Changes the values of a Ligthing.Atmosphere. |
| brightness |  | Intensity | Changes the value of Lighting.Brightness. |
| colorshift |  | BottomHue, TopHue | Changes the colors of Lighting.ColorShift_Bottom and Lighting.ColorShift_Top. |
| diffusescale |  | Scale | Changes the value of Lighting.EnvironmentDiffuseScale. |
| exposure |  | Amount | Changes the value of Lighting.ExposureCompensation. |
| fix |  |  | Reverts the environment to the original state. |
| fogcolor |  | Color3 | Changes the color of Lighting.FogColor. |
| fogend |  | Studs | Changes the value of Lighting.FogEnd. |
| fogstart |  | Studs | Changes the value of Lighting.FogStart. |
| gravity |  | Gravity | Changes the world's gravity. |
| latitude | geographiclatitude | Degrees | Changes the value of Lighting.GeographicLatitude. |
| outdoorambient |  | Hue | Changes the color of Lighting.OutdoorAmbient. |
| shadows | globalshadows | Enabled | Changes the value of Lighting.GlobalShadows. |
| skybox | sky, unskybox, unsky | Bottom, Back, Left, Top, Front, Right | Changes the skybox. |
| specularscale |  | Scale | Changes the value of Lighting.EnvironmentSpecularScale. |
| time | clocktime | Time, Duration | Changes the value of Lighting.ClockTime. |
| watercolor |  | Color | Changes the color of Terrain water. |
| waterreflectance |  | Reflectance | Changes the reflectance of Terrain water. |
| watersize |  | Size | Changes the wave size of Terrain water. |
| waterspeed |  | Speed | Changes the wave speed of Terrain water. |
| watertransparency |  | Transparency | Changes the transparency of Terrain water. |
| winddir | winddirection |  | Orients the wind direction along your camera. |
| windspeed |  | Speed | Changes the global wind speed. |

## Fun
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| char | character | Player(s), UserId | Changes the character of one or more player(s). |
| clone |  | Player(s) | Clones the character of one or more player(s). |
| confuse | reverse, unconfuse, unreverse | Player(s) | Inverts the controls of one or more player(s). |
| control | takeover | Player | Controls the character of a player. |
| creeper |  | Player(s) | Turns one or more player(s) into a creeper? Aww, man... |
| disco | 🪩, un🪩, undisco |  | It's time to party! 🎉 |
| dog | 🐶, 🐎, horse | Player(s) | Turns one or more player(s) into dog |
| explode | boom, 💥 | Player(s) | Explodes one or more player(s). |
| fling |  | Player(s), Strength | Flings one or more player(s). |
| glitch | unglitch, vibrate, unvibrate | Player(s), Distance | Makes one or more player(s) start glitching. |
| infect | zombie | Player(s) | Infects of one or more player(s), starting a zombie outbreak! |
| loopfling | unloopfling | Player(s), Strength | Flings one or more player(s) repeatedly. |
| noobify | noob | Player(s) | Turn one or more player(s) into a noob |
| nuke |  | Player(s) | Nuke one or more player(s). |
| poison |  | Player(s), Damage, Duration | Damages one or more player(s) over time. |
| rocket | 🚀 | Player(s) | Attaches a rocket to one or more player(s). |
| seizure | seize | Player(s) | Makes one or more player(s) start seizing. |
| setgravity | setgrav, grav, nograv, ungravity, ungrav, resetgravity, resetgrav | Player(s), Strength | Sets the gravity of one or more player(s). |
| size | resize, scale, unsize, unresize, unscale | Player(s), Scale | Resizes one or more player(s). |
| skydive | freefall | Player(s), Distance | Sends one or more player(s) into the sky. |
| slim | unslim | Player(s) | Makes one or more player(s) slim. |
| slippery | iceskate, icewalk, slide | Player(s) | Makes one or more player(s) slide when they walk |
| smite |  | Player(s) | Smites one or more player(s). |
| spin |  | Player(s), Speed | Spins one or more player(s). |
| trip |  | Player(s) | Trips one or more player(s). |
| unchar | uncharacter | Player(s) | Restores the character of one or more player(s). |
| uncreeper |  | Player(s) | Reverts one or more player(s) from a creeper |
| undog | un🐶, un🐎, unhorse | Player(s) | Reverts one or more player(s) from dog |
| unseizure | unseize | Player(s) | Saves one or more player(s) from seizing. |
| unspin |  | Player(s) | Stops spinning one or more player(s). |

## General
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| clean | clear, clr |  | Cleans up miscellaneous admin objects like cloned characters, looped commands, and scripts. |
| clip | unnoclip | Player(s) | Disables noclip for one or more player(s). |
| countdown | cd | Duration | Starts a countdown. |
| fly |  | Player(s), Speed, Constant | Enables flight for one or more player(s). |
| fullmessage | fm, fmsg | Message | Sends a full screen message to everyone in the server. |
| grouprank | grouprole | Player, GroupId | Gets a player's rank and role in a group. |
| hint | h | Message | Sends a hint to everyone in the server. |
| link | connect, track | Players, Persistent | Links one or more player(s) to your character. |
| message | m, msg | Message | Sends a message to everyone in the server. |
| noclip |  | Player(s), Flight, Speed | Enables noclip for one or more player(s). |
| notify | n | Player(s), Message | Sends a notification to one or more player(s). |
| notrip | unnotrip | Player(s) | Prevents one or more player(s) from tripping. |
| pause |  |  | Pauses the current sound. |
| pitch |  | Value | Changes the pitch of the currently playing sound. |
| play | music, sound, audio | AssetId | Plays a sound. |
| playercount | plrcount, countplayers, countplrs |  | Counts the number of players in-game. |
| privatehint | phint, ph | Player(s), Message | Sends a private hint to one or more player(s). |
| privatemessage | pm, pmsg | Player(s), Message | Sends a message to one or more player(s). |
| resume |  |  | Resumes the current sound. |
| spectate | spy, view | Player | Spectate a player's camera view. |
| stop | stopmusic |  | Stops the currently playing sound. |
| title | tag, untag, untitle | Player(s), Title, Color, SecondaryColor, Font | Changes the title of one or more player(s). |
| tts | speak | Voice, Text | Plays text to speech audio. |
| unfly |  | Player(s) | Disables flight for one or more player(s). |
| unlink | unconnect, untrack | Players | Removes a link from one or more player(s). |
| unspectate | unspy, unwatch, uncamera, unfollow, unview |  | Stop spectating. |
| volume |  | Value | Changes the volume of the currently playing sound. |
| vote | makevote, startvote, poll | Player(s), Question | Starts a vote for one or more player(s). |
| watch | camera, follow | Player | Watches a player with your camera. |
| whois | userinfo | Player | Displays detailed information about a player. |
| xray | wallhack, walls, unxray, unwallhack, unwalls | FillColor, OutlineColor | Show players through walls. |

## Moderation
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| ban |  | User(s), Duration, Reason | Bans one or more user(s) by UserId. |
| bans |  |  | Shows the bans in a separate window. |
| blind |  | Player(s) | Blinds one or more player(s). |
| bring |  | Player(s) | Teleports one or more player(s) to you. |
| buy | purchase | Player(s), InfoType, Identifier | Prompts a purchase for one or more player(s). |
| change |  | Player(s), Stat, Value | Changes a leaderstat of one or more player(s). |
| clearteams | ctm, cleartm |  | Clears all teams. |
| collide | nocollide, uncollide | Player(s) | Toggles collisions for one or more player(s) against other player(s). |
| copytools | ctools | Player(s), Player(s) | Copies tools from one or more player(s) to one or more player(s). |
| crash |  | Player(s) | Crashes one or more player(s). |
| createteam | cteam, newteam | Name, Color, AutoAssignable | Creates a new team with the given name and color. |
| editteam | eteam | Team, Name, Color, AutoAssignable | Edits a team with the given name and color. |
| forcefield | ff | Player(s) | Gives a ForceField to one or more player(s). |
| fov | unfov, resetfov | Player(s), Degrees | Changes the field of view of one or more player(s). |
| fps | lag, unlag, unfps | Player(s), FPS | Limits the frames per second of one or more player(s). |
| freeze | anchor, ice | Player(s) | Freezes one or more player(s). |
| give |  | Player(s), Tools | Gives a tool to one or more player(s).\nTools must be a descendant of <b>Lighting</b> or <b>ServerStorage</b>. |
| has | owns | Player, InfoType, Identifier | Checks if a player(s) owns an item. |
| heal |  | Player(s) | Heals one or more player(s). |
| health | maxhealth | Player(s), Max Health | Changes the maximum health one or more player(s). |
| hidename |  | Player(s) | Hides the character name of one or more player(s). |
| hurt | damage | Player(s), Damage | Damages one or more player(s). |
| immortal | god | Player(s) | Makes one or more player(s) invincible. |
| invisible | inv, hide | Player(s) | Makes one or more player(s) invisible. |
| jail |  | Player(s) | Jails one or more player(s). |
| jump |  | Player(s) | Makes one or more player(s) jump. |
| jumppower |  | Player(s), JumpPower | Changes the jump power of one or more player(s). |
| kick |  | Player(s), Reason | Kicks one or more player(s). |
| kill | slay, unalive, 💀 | Player(s) | Kills one or more player(s). |
| lock |  | Player(s) | Locks the character of one or more player(s). |
| loopkill | loopslay, loopunalive, loop💀, unloopkill, unloopslay, unloopunalive, unloop💀 | Player(s) | Kills one or more player(s) repeatedly. |
| members | admins, roles |  | Shows the roled members in a separate window. |
| mute | silence, shush, shh | Player(s) | Mutes one or more player(s). |
| name | nickname, displayname, unname | Player(s), DisplayName | Changes the DisplayName of one or more player(s). |
| punish |  | Player(s) | Punishes one or more player(s) to the void. |
| r6 | r15 | Player(s) | Changes the rig type of one or more player(s). |
| randomizeteams | randomiseteams, randomteams, rteams, rteam, rt | Player(s), Random Teams | Randomizes the team of one or more player(s) from a list of teams. |
| refresh | re | Player(s) | Refreshes the character of one or more player(s). |
| removearms | rarms | Player(s) | Removes the arms of one or more player(s). |
| removelegs | rlegs | Player(s) | Removes the legs of one or more player(s). |
| removelimbs | rlimbs | Player(s) | Removes the limbs of one or more player(s). |
| removeteam | delteam, deleteteam | Team | Removes a team with the given name. |
| removetools | rtools | Player(s) | Removes all tools from one or more player(s). |
| resetstats | rs | Player(s) | Resets the stats of one or more player(s). |
| respawn | spawn | Player(s) | Respawns the character of one or more player(s). |
| showname |  | Player(s) | Shows the character name of one or more player(s). |
| sit |  | Player(s) | Makes one or more player(s) sit. |
| slopeangle | maxslopeangle | Player(s), MaxSlopeAngle | Changes the max slope angle of one or more player(s). |
| speed | walkspeed | Player(s), Speed | Changes the walkspeed of one or more player(s). |
| startergive | sgive | Player(s), Tools | Permanently gives a tool to one or more player(s).\nTools must be a descendant of <b>Lighting</b> or <b>ServerStorage</b>. |
| starterjumppower |  | JumpPower | Changes the jump power of one or more player(s) when they spawn. |
| starterremove | sremove, unstartergive, unsgive | Player(s), Tools | Permanently removes a tool from one or more player(s). |
| starterslopeangle | startermaxslopeangle | MaxSlopeAngle | Changes the starting max slope angle of one or more player(s) when they spawn. |
| starterspeed | starterwalkspeed | Speed | Changes the walkspeed of one or more player(s) when they spawn. |
| startertools | starttools, stools |  | Views all tools in the StarterPack. |
| stun | disable | Player(s) | Stuns one or more player(s). |
| substitute | sub, subteams, switch, switchteams | Player1, Player2 | Switches the teams of 2 players and spawns them. |
| sword |  | Player(s) | Gives a sword to one or more player(s). |
| team | tm | Player(s), Team | Changes the team of one or more player(s). |
| teamrespawn | tmrs, trs, teamrs | Player(s), Team | Changes the team of one or more player(s) and spawns them. |
| thaw | unfreeze, unanchor, unice | Player(s) | Thaws one or more player(s). |
| to | goto | Destination | Teleports to a player. |
| toolban | bantools | Player(s) | Bans one or more player(s) from using tools. |
| tools | toollist |  | Views all tools usable with the give command. |
| tp | teleport | Player(s), Destination | Teleports one or more player(s) to another player. |
| unban |  | Player(s) | Unbans one or more player(s). |
| unblind |  | Player(s) | Unblinds one or more player(s). |
| unforcefield | unff, ungod, mortal | Player(s) | Removes a ForceField from one or more player(s). |
| unjail |  | Player(s) | Frees one or more player(s) from jail. |
| unlock |  | Player(s) | Unlocks the character of one or more player(s). |
| unmute | unsilence, unshush, unshh | Player(s) | Unmutes one or more player(s). |
| unpunish |  | Player(s) | Unpunishes one or more player(s) from the void. |
| unsit |  | Player(s) | Makes one or more player(s) stop sitting. |
| unstun | undisable, enable | Player(s) | Removes stun from one or more player(s). |
| untoolban | unbantools | Player(s) | Unbans one or more player(s) from using tools. |
| vehiclespeed |  | Player(s), Speed | Changes the vehicle speed of one or more player(s). |
| vehicletorque |  | Player(s), Torque | Changes the vehicle torque of one or more player(s). |
| viewtools | vtools | Player | Views all tools from a player. |
| visible | vis, show, unhide | Player(s) | Makes one or more player(s) visible. |

## SuperAdmin
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| badge | awardbadge, givebadge | Player(s), Badge ID | Awards a badge to one or more player(s). |
| btools | build, f3x | Player(s) | Gives Building Tools by F3X to one or more player(s). |
| chat | forcechat | Player(s), Message | Forces one or more player(s) to chat. |
| clearterrain | cterrain, clrterrain, removeterrain |  | Removes all terrain. |
| global | gcmd | Command string | Runs a command string globally in all servers. |
| incognito |  | Player(s), Hide Character | Hides one or more player(s) from lower rank players. (Persists until rejoin) |
| incognitolist |  |  | Views all incognito players in the server. |
| reserve | privateserver | AccessCode, PlaceId | Reserves a private server. |
| shutdown | stopserver | Delay, Reason | Shuts down the server. |
| unreserve | delreserve, removereserve, removeprivateserver | AccessCode | Removes a reserved server. |

## Utility
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| about | credit, credits, info |  | Shows the about tab in a separate window. |
| age | accountage | Player | Displays the account age of a player. |
| commandbar | cmdbar |  | Shows the command bar. |
| commands | cmds |  | Shows the commands in a separate window. |
| dashboard |  |  | Shows the admin dashboard. |
| donate | market, support |  | Shows the market tab in a separate window. |
| emotes |  |  | Shows the emotes list. |
| join |  | UserId | Join a player in the same game. |
| log | logs, debuglogs, errorlogs, chatlogs, commandlogs, joinlogs, damagelogs, killlogs, purchaselogs, clogs, cmdlogs, dmglogs, buylogs |  | Shows the logs in a separate window. |
| ping | getping, checkping, latency | Player | Displays the ping of a player. |
| prefix | hotkeys |  | Displays the prefix and hotkeys. |
| rejoin |  |  | Rejoins the server. |
| serverage | uptime |  | Displays the age of the server. |
| settings | set |  | Shows the settings in a separate window. |
| showfps | getfps, checkfps, playerfps | Player | Displays the frames per second of a player. |
| version |  |  | Displays the version of Kohl's Admin in this game. |
| viewas | unviewas | Roles(s) | Views the admin system as one or more role(s). |
| wait | delay | Seconds | Delays command execution for a period of time. |

## VIP
| Command | Aliases | Args | Description |
| --- | --- | --- | --- |
| bundle | 📦, un📦, unbundle | Player(s), AssetId | Applies a bundle to one or more player(s). |
| cape |  | Player(s), Color, Reflectance, Material, AssetId | Gives a cape to one or more player(s) |
| crm | uncrm | Player(s), Color, Reflectance, Material | Changes the color, reflectance, or material of one or more player(s). |
| crowncolor |  | Crown Color, Fire Color | Changes the VIP crown color. |
| emote | animation, anim, stopemote, stopanim | Player(s), Animation, Looping, Speed | Plays an animation on one or more player(s). |
| face | 🙂, un🙂, unface | Player(s), AssetId | Changes the face of one or more player(s). |
| fire | 🔥 | Player(s), Size, Color, SecondaryColor | Adds fire to one or more player(s). |
| goldify | gold | Player(s) | Glimmer like gold! |
| hat | 🎩, crmhat | Player(s), AssetIds, Texture, Color, Reflectance, Material | Gives one or more hats to one or more player(s). |
| head | 🗿, unhead | Player(s), AssetId | Changes the head of one or more player(s). |
| headless | nohead | Player(s), Full bundle | Apply headless head to one or more player(s) |
| headsize | bighead, hugehead, largehead, tinyhead, minihead, smallhead, normalhead | Player(s), Size | Changes the head size of one or more player(s). |
| highlight | hl, unhighlight, unhl | Player(s), FillColor, OutlineColor, FillTransparency, OutlineTransparency | Highlights one or more player(s). |
| korblox | korbloxleg | Player(s), Leg only | Apply korblox bundle to one or more player(s) |
| light | 💡, lamp, lite | Player(s), Range, Color | Adds a light to one or more player(s). |
| normal | uninfect | Player(s) | Returns one or more player(s) to their normal appearance. |
| pants | 👖, un👖, unpants | Player(s), AssetId | Changes the pants of one or more player(s). |
| particle | 💫, pe | Player(s), AssetId, Color | Adds a particle effect to one or more player(s). |
| rainbowcrown | crownrainbow |  | Toggles the VIP crown rainbow. |
| rainbowwings | wingsrainbow |  | Toggles the VIP wings rainbow. |
| removehats | remove🎩, r🎩, rhats | Player(s), AdminHats | Removes the hats of one or more player(s). |
| shine | 🌟, un🌟, unshine | Player(s) | Adds a shine effect to one or more player(s). |
| shiny |  | Player(s) | Shine like a diamond! |
| shirt | 👕, un👕, unshirt | Player(s), AssetId | Changes the shirt of one or more player(s). |
| silverify | silver, metalify, metal | Player(s) | Shine bright as a silver statue! |
| smoke | 💨 | Player(s), Color | Adds smoke to one or more player(s). |
| sparkles | ✨ | Player(s), Color | Adds sparkles to one or more player(s). |
| swagify | swag | Player(s) | Makes one or more player(s) swaggy. 😎 |
| trail | ☄️ | Player(s), Color | Adds a trail to one or more player(s). |
| tshirt | untshirt | Player(s), AssetId | Changes the t-shirt of one or more player(s). |
| uncape |  | Player(s) | Removes the cape from one or more player(s). |
| unfire | un🔥 | Player(s) | Removes fire from one or more player(s). |
| ungoldify | ungold, unsilverify, unsilver, unmetalify, unmetal | Player(s) | Restores the character of one or more player(s). |
| unlight | un💡, unlamp, unlite | Player(s) | Removes a light from one or more player(s). |
| unparticle | un💫, unpe | Player(s) | Removes a particle effect from one or more player(s). |
| unsmoke | un💨 | Player(s) | Removes smoke from one or more player(s). |
| unsparkles | un✨ | Player(s) | Removes sparkles from one or more player(s). |
| unswagify | unswag | Player(s) | Removes swag from one or more player(s). 👎 |
| untrail | un☄️ | Player(s) | Removers a trail from one or more player(s). |
| vampire | 🧛, dracula | Player(s) | Apply vampire bundle to one or more player(s) |
| werewolf | 🌕, wolf | Player(s) | Apply werewolf bundle to one or more player(s) |
| wingscolor |  | Wings Color | Changes the VIP wings color. |
