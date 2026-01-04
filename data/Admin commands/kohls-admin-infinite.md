# Kohl's Admin Commands (Infinite)
Source: https://github.com/kohls-admin/kohls-admin (commit f5ebabc9aa0a5e4a6e9671d9f5868bab057592af, accessed 2026-01-02); https://github.com/kohls-admin/kohls-admin (command order from DefaultCommands modules) (accessed 2026-01-02)
Default Prefixes: ;, :
Generated: 2026-01-02

## Administration
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | announce |  | Message | Shows a message to everyone in the game, saves and shows to new users until it has been cleared. |
| 2 | unannounce | clearannounce |  | Removes the pinned announcement. |
| 3 | role | rank | Users(s), Roles(s), Temporary | Assigns a role(s) to one or more user(s). |
| 4 | temprole | temprank | Users(s), Roles(s) | Assigns a temporary role(s) to one or more user(s). |
| 5 | unrole | removerole, unrank, removerank | Member(s), Roles(s) | Removes one or more role(s) from one or more member(s). |
| 6 | removemember | removepermissions, removeroles | Members(s) | Removes all roles and permissions from one or more member(s). |
| 7 | gear |  | Player(s), AssetId | Gives one or more player(s) a gear. |
| 8 | insert | ins | AssetId | Inserts a model at the player's position. |
| 9 | place | pl | Player(s), PlaceId | Teleports one or more player(s) to a place. |
| 10 | serverlock | slock |  | Locks the server preventing new players from joining. |
| 11 | unserverlock | unslock |  | Unlocks the server allowing new players to join again. |

## Creator
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | clearlogs | clrlogs |  | Removes all Kohl's Admin server logs. |
| 2 | hidelogs | unhidelogs | Player(s) | Hides the Kohl's Admin logs of one or more player(s). |
| 3 | script | s, loadstring | Source | Runs a script. |
| 4 | localscript | ls | Player(s), Source | Runs a script locally for one or more player(s). |

## Environment
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | fix |  |  | Reverts the environment to the original state. |
| 2 | ambient |  | Hue | Changes the color of Lighting.Ambient. |
| 3 | outdoorambient |  | Hue | Changes the color of Lighting.OutdoorAmbient. |
| 4 | atmosphere |  | Density, Offset, Color, DecayColor, Glare, Haze | Changes the values of a Ligthing.Atmosphere. |
| 5 | fogcolor |  | Color3 | Changes the color of Lighting.FogColor. |
| 6 | fogstart |  | Studs | Changes the value of Lighting.FogStart. |
| 7 | fogend |  | Studs | Changes the value of Lighting.FogEnd. |
| 8 | brightness |  | Intensity | Changes the value of Lighting.Brightness. |
| 9 | colorshift |  | BottomHue, TopHue | Changes the colors of Lighting.ColorShift_Bottom and Lighting.ColorShift_Top. |
| 10 | diffusescale |  | Scale | Changes the value of Lighting.EnvironmentDiffuseScale. |
| 11 | specularscale |  | Scale | Changes the value of Lighting.EnvironmentSpecularScale. |
| 12 | exposure |  | Amount | Changes the value of Lighting.ExposureCompensation. |
| 13 | time | clocktime | Time, Duration | Changes the value of Lighting.ClockTime. |
| 14 | latitude | geographiclatitude | Degrees | Changes the value of Lighting.GeographicLatitude. |
| 15 | shadows | globalshadows | Enabled | Changes the value of Lighting.GlobalShadows. |
| 16 | skybox | sky, unskybox, unsky | Bottom, Back, Left, Top, Front, Right | Changes the skybox. |
| 17 | airdensity |  | Density | Changes the air density used in aerodynamic forces model. |
| 18 | gravity |  | Gravity | Changes the world's gravity. |
| 19 | winddir | winddirection |  | Orients the wind direction along your camera. |
| 20 | windspeed |  | Speed | Changes the global wind speed. |
| 21 | watercolor |  | Color | Changes the color of Terrain water. |
| 22 | waterreflectance |  | Reflectance | Changes the reflectance of Terrain water. |
| 23 | watertransparency |  | Transparency | Changes the transparency of Terrain water. |
| 24 | watersize |  | Size | Changes the wave size of Terrain water. |
| 25 | waterspeed |  | Speed | Changes the wave speed of Terrain water. |

## Fun
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | disco | 🪩, un🪩, undisco |  | It's time to party! 🎉 |
| 2 | creeper |  | Player(s) | Turns one or more player(s) into a creeper? Aww, man... |
| 3 | uncreeper |  | Player(s) | Reverts one or more player(s) from a creeper |
| 4 | dog | 🐶, 🐎, horse | Player(s) | Turns one or more player(s) into dog |
| 5 | undog | un🐶, un🐎, unhorse | Player(s) | Reverts one or more player(s) from dog |
| 6 | char | character | Player(s), UserId | Changes the character of one or more player(s). |
| 7 | unchar | uncharacter | Player(s) | Restores the character of one or more player(s). |
| 8 | clone |  | Player(s) | Clones the character of one or more player(s). |
| 9 | control | takeover | Player | Controls the character of a player. |
| 10 | glitch | unglitch, vibrate, unvibrate | Player(s), Distance | Makes one or more player(s) start glitching. |
| 11 | seizure | seize | Player(s) | Makes one or more player(s) start seizing. |
| 12 | unseizure | unseize | Player(s) | Saves one or more player(s) from seizing. |
| 13 | infect | zombie | Player(s) | Infects of one or more player(s), starting a zombie outbreak! |
| 14 | explode | boom, 💥 | Player(s) | Explodes one or more player(s). |
| 15 | nuke |  | Player(s) | Nuke one or more player(s). |
| 16 | smite |  | Player(s) | Smites one or more player(s). |
| 17 | confuse | reverse, unconfuse, unreverse | Player(s) | Inverts the controls of one or more player(s). |
| 18 | fling |  | Player(s), Strength | Flings one or more player(s). |
| 19 | loopfling | unloopfling | Player(s), Strength | Flings one or more player(s) repeatedly. |
| 20 | poison |  | Player(s), Damage, Duration | Damages one or more player(s) over time. |
| 21 | spin |  | Player(s), Speed | Spins one or more player(s). |
| 22 | unspin |  | Player(s) | Stops spinning one or more player(s). |
| 23 | setgravity | setgrav, grav, nograv, ungravity, ungrav, resetgravity, resetgrav | Player(s), Strength | Sets the gravity of one or more player(s). |
| 24 | skydive | freefall | Player(s), Distance | Sends one or more player(s) into the sky. |
| 25 | trip |  | Player(s) | Trips one or more player(s). |
| 26 | rocket | 🚀 | Player(s) | Attaches a rocket to one or more player(s). |
| 27 | size | resize, scale, unsize, unresize, unscale | Player(s), Scale | Resizes one or more player(s). |
| 28 | slim | unslim | Player(s) | Makes one or more player(s) slim. |
| 29 | noobify | noob | Player(s) | Turn one or more player(s) into a noob |
| 30 | slippery | iceskate, icewalk, slide | Player(s) | Makes one or more player(s) slide when they walk |

## General
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | clean | clear, clr |  | Cleans up miscellaneous admin objects like cloned characters, looped commands, and scripts. |
| 2 | hint | h | Message | Sends a hint to everyone in the server. |
| 3 | message | m, msg | Message | Sends a message to everyone in the server. |
| 4 | privatehint | phint, ph | Player(s), Message | Sends a private hint to one or more player(s). |
| 5 | fullmessage | fm, fmsg | Message | Sends a full screen message to everyone in the server. |
| 6 | notify | n | Player(s), Message | Sends a notification to one or more player(s). |
| 7 | privatemessage | pm, pmsg | Player(s), Message | Sends a message to one or more player(s). |
| 8 | countdown | cd | Duration | Starts a countdown. |
| 9 | title | tag, untag, untitle | Player(s), Title, Color, SecondaryColor, Font | Changes the title of one or more player(s). |
| 10 | vote | makevote, startvote, poll | Player(s), Question | Starts a vote for one or more player(s). |
| 11 | link | connect, track | Players, Persistent | Links one or more player(s) to your character. |
| 12 | unlink | unconnect, untrack | Players | Removes a link from one or more player(s). |
| 13 | watch | camera, follow | Player | Watches a player with your camera. |
| 14 | spectate | spy, view | Player | Spectate a player's camera view. |
| 15 | unspectate | unspy, unwatch, uncamera, unfollow, unview |  | Stop spectating. |
| 16 | fly |  | Player(s), Speed, Constant | Enables flight for one or more player(s). |
| 17 | unfly |  | Player(s) | Disables flight for one or more player(s). |
| 18 | noclip |  | Player(s), Flight, Speed | Enables noclip for one or more player(s). |
| 19 | clip | unnoclip | Player(s) | Disables noclip for one or more player(s). |
| 20 | notrip | unnotrip | Player(s) | Prevents one or more player(s) from tripping. |
| 21 | xray | wallhack, walls, unxray, unwallhack, unwalls | FillColor, OutlineColor | Show players through walls. |
| 22 | whois | userinfo | Player | Displays detailed information about a player. |
| 23 | grouprank | grouprole | Player, GroupId | Gets a player's rank and role in a group. |
| 24 | playercount | plrcount, countplayers, countplrs |  | Counts the number of players in-game. |
| 25 | tts | speak | Voice, Text | Plays text to speech audio. |
| 26 | play | music, sound, audio | AssetId | Plays a sound. |
| 27 | pause |  |  | Pauses the current sound. |
| 28 | resume |  |  | Resumes the current sound. |
| 29 | stop | stopmusic |  | Stops the currently playing sound. |
| 30 | pitch |  | Value | Changes the pitch of the currently playing sound. |
| 31 | volume |  | Value | Changes the volume of the currently playing sound. |

## Moderation
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | bans |  |  | Shows the bans in a separate window. |
| 2 | members | admins, roles |  | Shows the roled members in a separate window. |
| 3 | ban |  | User(s), Duration, Reason | Bans one or more user(s) by UserId. |
| 4 | unban |  | Player(s) | Unbans one or more player(s). |
| 5 | kick |  | Player(s), Reason | Kicks one or more player(s). |
| 6 | crash |  | Player(s) | Crashes one or more player(s). |
| 7 | mute | silence, shush, shh | Player(s) | Mutes one or more player(s). |
| 8 | unmute | unsilence, unshush, unshh | Player(s) | Unmutes one or more player(s). |
| 9 | punish |  | Player(s) | Punishes one or more player(s) to the void. |
| 10 | unpunish |  | Player(s) | Unpunishes one or more player(s) from the void. |
| 11 | name | nickname, displayname, unname | Player(s), DisplayName | Changes the DisplayName of one or more player(s). |
| 12 | hidename |  | Player(s) | Hides the character name of one or more player(s). |
| 13 | showname |  | Player(s) | Shows the character name of one or more player(s). |
| 14 | toolban | bantools | Player(s) | Bans one or more player(s) from using tools. |
| 15 | untoolban | unbantools | Player(s) | Unbans one or more player(s) from using tools. |
| 16 | give |  | Player(s), Tools | Gives a tool to one or more player(s).\nTools must be a descendant of <b>Lighting</b> or <b>ServerStorage</b>. |
| 17 | tools | toollist |  | Views all tools usable with the give command. |
| 18 | startergive | sgive | Player(s), Tools | Permanently gives a tool to one or more player(s).\nTools must be a descendant of <b>Lighting</b> or <b>ServerStorage</b>. |
| 19 | starterremove | sremove, unstartergive, unsgive | Player(s), Tools | Permanently removes a tool from one or more player(s). |
| 20 | copytools | ctools | Player(s), Player(s) | Copies tools from one or more player(s) to one or more player(s). |
| 21 | removetools | rtools | Player(s) | Removes all tools from one or more player(s). |
| 22 | startertools | starttools, stools |  | Views all tools in the StarterPack. |
| 23 | viewtools | vtools | Player | Views all tools from a player. |
| 24 | sword |  | Player(s) | Gives a sword to one or more player(s). |
| 25 | kill | slay, unalive, 💀 | Player(s) | Kills one or more player(s). |
| 26 | loopkill | loopslay, loopunalive, loop💀, unloopkill, unloopslay, unloopunalive, unloop💀 | Player(s) | Kills one or more player(s) repeatedly. |
| 27 | hurt | damage | Player(s), Damage | Damages one or more player(s). |
| 28 | health | maxhealth | Player(s), Max Health | Changes the maximum health one or more player(s). |
| 29 | heal |  | Player(s) | Heals one or more player(s). |
| 30 | immortal | god | Player(s) | Makes one or more player(s) invincible. |
| 31 | forcefield | ff | Player(s) | Gives a ForceField to one or more player(s). |
| 32 | unforcefield | unff, ungod, mortal | Player(s) | Removes a ForceField from one or more player(s). |
| 33 | invisible | inv, hide | Player(s) | Makes one or more player(s) invisible. |
| 34 | visible | vis, show, unhide | Player(s) | Makes one or more player(s) visible. |
| 35 | blind |  | Player(s) | Blinds one or more player(s). |
| 36 | unblind |  | Player(s) | Unblinds one or more player(s). |
| 37 | freeze | anchor, ice | Player(s) | Freezes one or more player(s). |
| 38 | thaw | unfreeze, unanchor, unice | Player(s) | Thaws one or more player(s). |
| 39 | jail |  | Player(s) | Jails one or more player(s). |
| 40 | unjail |  | Player(s) | Frees one or more player(s) from jail. |
| 41 | fps | lag, unlag, unfps | Player(s), FPS | Limits the frames per second of one or more player(s). |
| 42 | lock |  | Player(s) | Locks the character of one or more player(s). |
| 43 | unlock |  | Player(s) | Unlocks the character of one or more player(s). |
| 44 | stun | disable | Player(s) | Stuns one or more player(s). |
| 45 | unstun | undisable, enable | Player(s) | Removes stun from one or more player(s). |
| 46 | bring |  | Player(s) | Teleports one or more player(s) to you. |
| 47 | to | goto | Destination | Teleports to a player. |
| 48 | tp | teleport | Player(s), Destination | Teleports one or more player(s) to another player. |
| 49 | fov | unfov, resetfov | Player(s), Degrees | Changes the field of view of one or more player(s). |
| 50 | jump |  | Player(s) | Makes one or more player(s) jump. |
| 51 | jumppower |  | Player(s), JumpPower | Changes the jump power of one or more player(s). |
| 52 | starterjumppower |  | JumpPower | Changes the jump power of one or more player(s) when they spawn. |
| 53 | sit |  | Player(s) | Makes one or more player(s) sit. |
| 54 | unsit |  | Player(s) | Makes one or more player(s) stop sitting. |
| 55 | speed | walkspeed | Player(s), Speed | Changes the walkspeed of one or more player(s). |
| 56 | starterspeed | starterwalkspeed | Speed | Changes the walkspeed of one or more player(s) when they spawn. |
| 57 | vehiclespeed |  | Player(s), Speed | Changes the vehicle speed of one or more player(s). |
| 58 | vehicletorque |  | Player(s), Torque | Changes the vehicle torque of one or more player(s). |
| 59 | slopeangle | maxslopeangle | Player(s), MaxSlopeAngle | Changes the max slope angle of one or more player(s). |
| 60 | starterslopeangle | startermaxslopeangle | MaxSlopeAngle | Changes the starting max slope angle of one or more player(s) when they spawn. |
| 61 | r6 | r15 | Player(s) | Changes the rig type of one or more player(s). |
| 62 | respawn | spawn | Player(s) | Respawns the character of one or more player(s). |
| 63 | refresh | re | Player(s) | Refreshes the character of one or more player(s). |
| 64 | removelimbs | rlimbs | Player(s) | Removes the limbs of one or more player(s). |
| 65 | removearms | rarms | Player(s) | Removes the arms of one or more player(s). |
| 66 | removelegs | rlegs | Player(s) | Removes the legs of one or more player(s). |
| 67 | buy | purchase | Player(s), InfoType, Identifier | Prompts a purchase for one or more player(s). |
| 68 | has | owns | Player, InfoType, Identifier | Checks if a player(s) owns an item. |
| 69 | change |  | Player(s), Stat, Value | Changes a leaderstat of one or more player(s). |
| 70 | resetstats | rs | Player(s) | Resets the stats of one or more player(s). |
| 71 | team | tm | Player(s), Team | Changes the team of one or more player(s). |
| 72 | teamrespawn | tmrs, trs, teamrs | Player(s), Team | Changes the team of one or more player(s) and spawns them. |
| 73 | substitute | sub, subteams, switch, switchteams | Player1, Player2 | Switches the teams of 2 players and spawns them. |
| 74 | randomizeteams | randomiseteams, randomteams, rteams, rteam, rt | Player(s), Random Teams | Randomizes the team of one or more player(s) from a list of teams. |
| 75 | createteam | cteam, newteam | Name, Color, AutoAssignable | Creates a new team with the given name and color. |
| 76 | editteam | eteam | Team, Name, Color, AutoAssignable | Edits a team with the given name and color. |
| 77 | removeteam | delteam, deleteteam | Team | Removes a team with the given name. |
| 78 | clearteams | ctm, cleartm |  | Clears all teams. |
| 79 | collide | nocollide, uncollide | Player(s) | Toggles collisions for one or more player(s) against other player(s). |

## SuperAdmin
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | badge | awardbadge, givebadge | Player(s), Badge ID | Awards a badge to one or more player(s). |
| 2 | btools | build, f3x | Player(s) | Gives Building Tools by F3X to one or more player(s). |
| 3 | chat | forcechat | Player(s), Message | Forces one or more player(s) to chat. |
| 4 | clearterrain | cterrain, clrterrain, removeterrain |  | Removes all terrain. |
| 5 | incognito |  | Player(s), Hide Character | Hides one or more player(s) from lower rank players. (Persists until rejoin) |
| 6 | incognitolist |  |  | Views all incognito players in the server. |
| 7 | reserve | privateserver | AccessCode, PlaceId | Reserves a private server. |
| 8 | unreserve | delreserve, removereserve, removeprivateserver | AccessCode | Removes a reserved server. |
| 9 | shutdown | stopserver | Delay, Reason | Shuts down the server. |
| 10 | global | gcmd | Command string | Runs a command string globally in all servers. |

## Utility
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | version |  |  | Displays the version of Kohl's Admin in this game. |
| 2 | prefix | hotkeys |  | Displays the prefix and hotkeys. |
| 3 | about | credit, credits, info |  | Shows the about tab in a separate window. |
| 4 | commands | cmds |  | Shows the commands in a separate window. |
| 5 | commandbar | cmdbar |  | Shows the command bar. |
| 6 | dashboard |  |  | Shows the admin dashboard. |
| 7 | donate | market, support |  | Shows the market tab in a separate window. |
| 8 | log | logs, debuglogs, errorlogs, chatlogs, commandlogs, joinlogs, damagelogs, killlogs, purchaselogs, clogs, cmdlogs, dmglogs, buylogs |  | Shows the logs in a separate window. |
| 9 | settings | set |  | Shows the settings in a separate window. |
| 10 | emotes |  |  | Shows the emotes list. |
| 11 | age | accountage | Player | Displays the account age of a player. |
| 12 | serverage | uptime |  | Displays the age of the server. |
| 13 | showfps | getfps, checkfps, playerfps | Player | Displays the frames per second of a player. |
| 14 | ping | getping, checkping, latency | Player | Displays the ping of a player. |
| 15 | wait | delay | Seconds | Delays command execution for a period of time. |
| 16 | rejoin |  |  | Rejoins the server. |
| 17 | join |  | UserId | Join a player in the same game. |
| 18 | viewas | unviewas | Roles(s) | Views the admin system as one or more role(s). |

## VIP
| Order | Command | Aliases | Args | Description |
| --- | --- | --- | --- | --- |
| 1 | emote | animation, anim, stopemote, stopanim | Player(s), Animation, Looping, Speed | Plays an animation on one or more player(s). |
| 2 | normal | uninfect | Player(s) | Returns one or more player(s) to their normal appearance. |
| 3 | fire | 🔥 | Player(s), Size, Color, SecondaryColor | Adds fire to one or more player(s). |
| 4 | unfire | un🔥 | Player(s) | Removes fire from one or more player(s). |
| 5 | smoke | 💨 | Player(s), Color | Adds smoke to one or more player(s). |
| 6 | unsmoke | un💨 | Player(s) | Removes smoke from one or more player(s). |
| 7 | sparkles | ✨ | Player(s), Color | Adds sparkles to one or more player(s). |
| 8 | unsparkles | un✨ | Player(s) | Removes sparkles from one or more player(s). |
| 9 | light | 💡, lamp, lite | Player(s), Range, Color | Adds a light to one or more player(s). |
| 10 | unlight | un💡, unlamp, unlite | Player(s) | Removes a light from one or more player(s). |
| 11 | highlight | hl, unhighlight, unhl | Player(s), FillColor, OutlineColor, FillTransparency, OutlineTransparency | Highlights one or more player(s). |
| 12 | particle | 💫, pe | Player(s), AssetId, Color | Adds a particle effect to one or more player(s). |
| 13 | unparticle | un💫, unpe | Player(s) | Removes a particle effect from one or more player(s). |
| 14 | trail | ☄️ | Player(s), Color | Adds a trail to one or more player(s). |
| 15 | untrail | un☄️ | Player(s) | Removers a trail from one or more player(s). |
| 16 | shine | 🌟, un🌟, unshine | Player(s) | Adds a shine effect to one or more player(s). |
| 17 | bundle | 📦, un📦, unbundle | Player(s), AssetId | Applies a bundle to one or more player(s). |
| 18 | headless | nohead | Player(s), Full bundle | Apply headless head to one or more player(s) |
| 19 | korblox | korbloxleg | Player(s), Leg only | Apply korblox bundle to one or more player(s) |
| 20 | werewolf | 🌕, wolf | Player(s) | Apply werewolf bundle to one or more player(s) |
| 21 | vampire | 🧛, dracula | Player(s) | Apply vampire bundle to one or more player(s) |
| 22 | cape |  | Player(s), Color, Reflectance, Material, AssetId | Gives a cape to one or more player(s) |
| 23 | uncape |  | Player(s) | Removes the cape from one or more player(s). |
| 24 | hat | 🎩, crmhat | Player(s), AssetIds, Texture, Color, Reflectance, Material | Gives one or more hats to one or more player(s). |
| 25 | removehats | remove🎩, r🎩, rhats | Player(s), AdminHats | Removes the hats of one or more player(s). |
| 26 | head | 🗿, unhead | Player(s), AssetId | Changes the head of one or more player(s). |
| 27 | headsize | bighead, hugehead, largehead, tinyhead, minihead, smallhead, normalhead | Player(s), Size | Changes the head size of one or more player(s). |
| 28 | face | 🙂, un🙂, unface | Player(s), AssetId | Changes the face of one or more player(s). |
| 29 | shirt | 👕, un👕, unshirt | Player(s), AssetId | Changes the shirt of one or more player(s). |
| 30 | pants | 👖, un👖, unpants | Player(s), AssetId | Changes the pants of one or more player(s). |
| 31 | tshirt | untshirt | Player(s), AssetId | Changes the t-shirt of one or more player(s). |
| 32 | crm | uncrm | Player(s), Color, Reflectance, Material | Changes the color, reflectance, or material of one or more player(s). |
| 33 | goldify | gold | Player(s) | Glimmer like gold! |
| 34 | shiny |  | Player(s) | Shine like a diamond! |
| 35 | silverify | silver, metalify, metal | Player(s) | Shine bright as a silver statue! |
| 36 | ungoldify | ungold, unsilverify, unsilver, unmetalify, unmetal | Player(s) | Restores the character of one or more player(s). |
| 37 | swagify | swag | Player(s) | Makes one or more player(s) swaggy. 😎 |
| 38 | unswagify | unswag | Player(s) | Removes swag from one or more player(s). 👎 |
| 39 | wingscolor |  | Wings Color | Changes the VIP wings color. |
| 40 | rainbowwings | wingsrainbow |  | Toggles the VIP wings rainbow. |
| 41 | crowncolor |  | Crown Color, Fire Color | Changes the VIP crown color. |
| 42 | rainbowcrown | crownrainbow |  | Toggles the VIP crown rainbow. |
