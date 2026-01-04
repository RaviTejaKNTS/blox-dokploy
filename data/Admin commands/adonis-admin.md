# Adonis Admin Commands
Source: https://github.com/Epix-Incorporated/Adonis (commit c682303f72414f453a4825cb4f7ab737838c66b5, accessed 2026-01-02); https://github.com/Epix-Incorporated/Adonis (command order from source modules) (accessed 2026-01-02)
Default Prefixes: :, ; (Player Prefix: !)
Generated: 2026-01-02

## Admins
| Order | Commands | Args | Admin Level | Description |
| --- | --- | --- | --- | --- |
| 1 | setrank, permrank, permsetrank | player/user, rank | Admins | Sets the admin rank of the target user(s); THIS SAVES! |
| 2 | settemprank, temprank, tempsetrank | player, rank | Admins |  |
| 3 | setlevel, setadminlevel | player, level | Admins | Sets the target player(s) permission level for the current server; does not save |
| 4 | unadmin, unmod, unowner, unpadmin, unheadadmin, unrank | player/user / list entry, temp? (true/false) (default: false) | Admins | Removes admin/moderator ranks from the target player(s); saves unless <temp> is 'true' |
| 5 | tempunadmin, untempadmin, tunadmin, untadmin | player | Admins | Removes the target players' admin powers for this server; does not save |
| 6 | tempmod, tmod, tempmoderator, tmoderator | player | Admins | Makes the target player(s) a temporary moderator; does not save |
| 7 | permmod, pmod, mod, moderator, pmoderator | player/user | Admins | Makes the target player(s) a moderator; saves |
| 8 | broadcast, bc | Message | Admins | Makes a message in the chat window |
| 9 | shutdownlogs, shutdownlog, slogs, shutdowns |  | Admins | Shows who shutdown or restarted a server and when |
| 10 | slock, serverlock, lockserver | on/off | Admins | Enables/disables server lock |
| 11 | wl, enablewhitelist, whitelist | on/off/add/remove/list/clear, optional player | Admins | Enables/disables the server whitelist; :wl username to add them to the whitelist |
| 12 | sn, systemnotify, sysnotif, sysnotify, systemsmallmessage, snmessage, snmsg, ssmsg, ssmessage | message | Admins | Makes a system small message |
| 13 | setmessage, notif, setmsg, permhint | message OR off | Admins | Sets a small hint message at the top of the screen |
| 14 | setbanmessage, setbmsg | message | Admins | Sets the ban message banned players see |
| 15 | setlockmessage, slockmsg, setlmsg | message | Admins | Sets the lock message unwhitelisted players see if :whitelist or :slock is on |
| 16 | sm, systemmessage, sysmsg | message | Admins | Same as message but says SYSTEM MESSAGE instead of your name, or whatever system message title is server to... |
| 17 | setcoreguienabled, setcoreenabled, showcoregui, setcoregui, setcgui, setcore, setcge | player, All/Backpack/Chat/EmotesMenu/Health/PlayerList, true/false | Admins | Enables or disables CoreGui elements for the target player(s) |
| 18 | alert, alarm, annoy | player, message | Admins | Get someone's attention |
| 19 | lockmap |  | Admins | Locks the map |
| 20 | unlockmap |  | Admins | Unlocks the map |
| 21 | btools, f3x, buildtools, buildingtools, buildertools | player | Admins | Gives the target player(s) F3X building tools. |
| 22 | insert, ins | id | Admins | Inserts whatever object belongs to the ID you supply, the object must be in the place owner's or Roblox's inventory |
| 23 | addtool, savetool, maketool | optional player, optional new tool name | Admins |  |
| 24 | clraddedtools, clearaddedtools, clearsavedtools, clrsavedtools |  | Admins |  |
| 25 | newteam, createteam, maketeam | name, BrickColor | Admins | Make a new team with the specified name and color |
| 26 | removeteam, deleteteam | name | Admins | Remove the specified team |
| 27 | restoremap, maprestore, rmap |  | Admins | Restore the map to the the way it was the last time it was backed up |
| 28 | note, writenote, makenote | player, note | Admins | Makes a note on the target player(s) that says <note> |
| 29 | removenote, remnote, deletenote, clearnote | player, note (specify 'all' to delete all notes) | Admins | Removes a note on the target player(s) |
| 30 | notes, viewnotes | player | Admins | Views notes on the target player(s) |
| 31 | loopkill | player, num (optional) | Admins | Repeatedly kills the target player(s) |
| 32 | unloopkill | player | Admins | Un-Loop Kill |
| 33 | lag, fpslag | player | Admins | Makes the target player(s)'s FPS drop |
| 34 | unlag, unfpslag | player | Admins | Un-Lag |
| 35 | crash | player | Admins | Crashes the target player(s) |
| 36 | hardcrash | player | Admins | Hard-crashes the target player(s) |
| 37 | ramcrash, memcrash | player | Admins | RAM-crashes the target player(s) |
| 38 | gpucrash | player | Admins | GPU crashes the target player(s) |
| 39 | ckick, customkick, customcrash | player, title, message | Admins | Disconnects (crashes) the target player with a custom Roblox dialog |
| 40 | shutdown | reason | Admins | Shuts the server down |
| 41 | serverban, ban | player/user, reason | Admins | Bans the target player(s) from the server |
| 42 | unserverban, unban | user | Admins | Unbans the target user(s) from the server |
| 43 | banmenu |  | Admins | Opens the ban menu |
| 44 | cm, custommessage | Upper message, message | Admins | Same as message but says whatever you want upper message to be instead of your name. |
| 45 | nil | player | Admins |  |
| 46 | promptpremiumpurchase, premiumpurchaseprompt | player | Admins | Opens the Roblox Premium purchase prompt for the target player(s) |
| 47 | rbxnotify, robloxnotify, robloxnotif, rblxnotify, rnotif, rn | player, duration (seconds), text | Admins | Sends a Roblox-styled notification for the target player(s) |
| 48 | disguise, masquerade | player, username | Admins | Names the player, chars the player, and modifies the player's chat tag |
| 49 | undisguise, removedisguise, cleardisguise, nodisguise | player | Admins | Removes the player's disguise |

## Creators
| Order | Commands | Args | Admin Level | Description |
| --- | --- | --- | --- | --- |
| 1 | directban | username(s), reason | Creators | Adds the specified user(s) to the global ban list; saves |
| 2 | directunban, undirectban | username(s) | Creators | Removes the specified user(s) from the global ban list; saves |
| 3 | globalplace, gplace, globalforceplace | placeId | Creators | Force all game-players to teleport to a desired place |
| 4 | forceplace | player, placeId/serverName | Creators | Force the target player(s) to teleport to the desired place |
| 5 | :adonissettings |  | Creators | Opens the Adonis settings management interface |
| 6 | headadmin, owner, hadmin, oa | player | Creators | Makes the target player(s) a HeadAdmin; Saves |
| 7 | tempheadadmin, tempowner, toa, thadmin | player | Creators | Makes the target player(s) a temporary head admin; Does not save |
| 8 | sudo | player, command | Creators | Runs a command as the target player(s) |
| 9 | clearplayerdata, clrplrdata, clearplrdata, clrplayerdata | UserId | Creators | Clears PlayerData linked to the specified UserId |
| 10 | :terminal, :console |  | Creators | Opens the debug terminal |
| 11 | scripteditor, se | new/edit/delete/run, name | Creators | Opens Script editor |
| 12 | starterscript, clientstarterscript, starterclientscript, createstarterscript | name, code | Creators | Executes the given code on everyone's client upon respawn |
| 13 | clearoldlogs, flusholdlogs |  | Creators | Clears old logs |
| 14 | taskmgr, taskmanager |  | Creators | Task manager |

## Donors
| Order | Commands | Args | Admin Level | Description |
| --- | --- | --- | --- | --- |
| 1 | uncape, removedonorcape |  | Donors | Remove donor cape |
| 2 | cape, donorcape |  | Donors |  |
| 3 | removetshirt, untshirt, notshirt |  | Donors | Remove the t-shirt you are wearing, if any |
| 4 | neon, donorneon | color | Donors | Changes your body material to neon and makes you the (optional) color of your choosing. |
| 5 | fire, donorfire | color (optional) | Donors | Gives you fire with the specified color (if you specify one) |
| 6 | sparkles, donorsparkles | color (optional) | Donors | Gives you sparkles with the specified color (if you specify one) |
| 7 | light, donorlight | color (optional) | Donors | Gives you a PointLight with the specified color (if you specify one) |
| 8 | particle, donorparticle | textureid, startColor3, endColor3 | Donors | Put a custom particle emitter on your character |
| 9 | unparticle, removeparticles, undonorparticle |  | Donors | Removes donor particles on you |
| 10 | unfire, undonorfire |  | Donors | Removes donor fire on you |
| 11 | unsparkles, undonorsparkles |  | Donors | Removes donor sparkles on you |
| 12 | unlight, undonorlight |  | Donors | Removes donor light on you |
| 13 | avataritem, accessory, hat, donorhat, shirt, donorshirt, tshirt, donortshirt, givetshirt, shirt, donorshirt, giveshirt, pants, donorpants, givepants, face, donorface, animation, anim | ID | Donors | Gives yourself the avatar item that belongs to <ID> |
| 14 | saveoutfit, savefit |  | Donors | Saves your current character's appearance when respawning |
| 15 | removesavedoutfit, removeoutfit, removefit, defaultavatar |  | Donors | Removes any currently saved outfits and reverts your character to its original look |
| 16 | myhats, hatlist, hats, donorhats |  | Donors | Shows you a list of hats you are currently wearing |
| 17 | removehat, removedonorhat | name | Donors | Removes a specific accessory you are currently wearing |
| 18 | removehats, nohats, nodonorhats, clearhats |  | Donors | Removes any hats you are currently wearing |

## Fun
| Order | Commands | Args | Admin Level | Description |
| --- | --- | --- | --- | --- |
| 1 | glitch, glitchdisorient, glitch1, glitchy | player, intensity | Moderators | Makes the target player(s)'s character teleport back and forth rapidly, quite trippy, makes bricks appear to move as the player turns their character |
| 2 | ghostglitch, glitch2, glitchghost | player, intensity | Moderators | The same as gd but less trippy, teleports the target player(s) back and forth in the same direction, making two ghost like images of the game |
| 3 | vibrate, glitchvibrate | player, intensity | Moderators | Kinda like gd, but teleports the player to four points instead of two |
| 4 | unglitch, unglitchghost, ungd, ungg, ungv, unvibrate | player | Moderators | UnGlitchs the target player(s) |
| 5 | setfps | player, fps | Admins | Sets the target players's FPS |
| 6 | restorefps, revertfps, unsetfps | player | Admins | Restores the target players's FPS |
| 7 | gerald | player | Moderators | A massive Gerald AloeVera hat. |
| 8 | ungerald | player | Moderators | De-Geraldification |
| 9 | wat |  | Players | ??? |
| 10 | trolled, freebobuc, freedonor, adminpls, enabledonor, freeadmin, hackadmin |  | Players | You've Been Trolled You've Been Trolled Yes You've Probably Been Told... |
| 11 | trigger, triggered | player | Moderators | Makes the target player really angry |
| 12 | brazil, sendtobrazil | players | Moderators | You're going to 🇧🇷. |
| 13 | chargear, charactergear, doll, cgear, playergear, dollify, pgear, plrgear | player/username, steal | Moderators | Gives you a doll of a player |
| 14 | lowres, pixelrender, pixel, pixelize | player, pixelSize, renderDist | Admins | Pixelizes the player's view |
| 15 | zawarudo, stoptime |  | Admins | Freezes everything but the player running the command |
| 16 | unzawarudo, unstoptime |  | Admins | Stops zawarudo |
| 17 | dizzy | player, speed | Admins | Causes motion sickness |
| 18 | undizzy | player | Admins | UnDizzy |
| 19 | Davey_Bones, davey | player | Moderators | Turns you into me <3 |
| 20 | boombox | player | Moderators | Gives the target player(s) a boombox |
| 21 | infect, zombify | player | Moderators | Turn the target player(s) into a suit zombie |
| 22 | rainbowify, rainbow | player | Moderators | Make the target player(s)'s character flash rainbow colors |
| 23 | unrainbowify, unrainbow | player | Moderators | Removes the rainbow effect from the player(s) specified |
| 24 | noobify, noob | player | Moderators | Make the target player(s) look like a noob |
| 25 | material, mat | player, material | Moderators | Make the target the material you choose |
| 26 | neon, neonify | player, (optional)color | Moderators | Make the target neon |
| 27 | ghostify, ghost | player | Moderators | Turn the target player(s) into a ghost |
| 28 | goldify, gold | player | Moderators | Make the target player(s) look like gold |
| 29 | shiney, shineify, shine | player | Moderators | Make the target player(s)'s character shiney |
| 30 | spook | player | Moderators | Makes the target player(s)'s screen 2spooky4them |
| 31 | thanos, thanossnap, balancetheserver, snap | player | Admins | \ |
| 32 | sword, givesword | player, allow teamkill (default: true), base dmg (default: 5), slash dmg (default: 10), lunge dmg (default: 30) | Moderators | Gives the target player(s) a sword |
| 33 | iloveyou, alwaysnear, alwayswatching |  | Players | I love you. You are mine. Do not fear; I will always be near. |
| 34 | theycome, fromanotherworld, ufo, abduct, space, newmexico, area51, rockwell | player | Admins | A world unlike our own. |
| 35 | blind | player | Moderators | Blinds the target player(s) |
| 36 | screenimage, scrimage, image | player, textureid | Moderators | Places the desired image on the target's screen |
| 37 | screenvideo, scrvid, video | player, videoid | Moderators | Places the desired video on the target's screen |
| 38 | uneffect, unimage, uneffectgui, unspook, unblind, unstrobe, untrippy, unpixelize, unlowres, unpixel, undance, unflashify, guifix, fixgui | player | Moderators | Removes any effect GUIs on the target player(s) |
| 39 | forest, sendtotheforest, intothewoods | player | Admins | Sends player to The Forest for a timeout |
| 40 | maze, sendtothemaze, mazerunner | player | Admins | Sends player to The Maze for a timeout |
| 41 | clown, yoink, youloveme, van | player | Admins | Clowns. |
| 42 | chik3n, zelith, z3lith |  | HeadAdmins | Call on the KFC dark prophet powers of chicken |
| 43 | tornado, twister | player, optional time | HeadAdmins | Makes a tornado on the target player(s) |
| 44 | nuke | player, size | Admins | Nuke the target player(s) |
| 45 | stopwildfire, removewildfire, unwildfire |  | HeadAdmins | Stops :wildfire from spreading further |
| 46 | wildfire | player | HeadAdmins | Starts a fire at the target player(s); Ignores locked parts and parts named 'BasePlate' or 'Baseplate' |
| 47 | swagify, swagger | player | Moderators | Swag the target player(s) up |
| 48 | shrek, shrekify, shrekislife, swamp | player | Moderators | Shrekify the target player(s) |
| 49 | rocket, firework | player | Moderators | Send the target player(s) to the moon! |
| 50 | dance | player | Moderators | Make the target player(s) dance |
| 51 | breakdance, fundance, lolwut | player | Moderators | Make the target player(s) break dance |
| 52 | puke, barf, throwup, vomit | player | Moderators | Make the target player(s) puke |
| 53 | poison | player | Moderators | Slowly kills the target player(s) |
| 54 | hatpets | player, number[50 MAX]/destroy | Moderators |  |
| 55 | pets | follow/float/swarm/attack, player | Players | Makes your hat pets do the specified command (follow/float/swarm/attack) |
| 56 | grav, bringtoearth | player | Moderators | Makes the target player(s)'s gravity normal |
| 57 | setgrav, gravity, setgravity | player, number | Moderators | Set the target player(s)'s gravity |
| 58 | nograv, nogravity, superjump | player | Moderators | NoGrav the target player(s) |
| 59 | bunnyhop, bhop | player | Moderators | Makes the player jump, and jump... and jump. Just like the rabbit noobs you find in sf games ;) |
| 60 | unbunnyhop | player | Moderators | Stops the forced hippity hoppening |
| 61 | freefall, skydive | player, height | Moderators | Teleport the target player(s) up by <height> studs |
| 62 | stickify, stick, stickman | player | Moderators | Turns the target player(s) into a stick figure |
| 63 | hole, sparta | player | Moderators | Sends the target player(s) down a hole |
| 64 | lightning, smite | player | Moderators | Zeus strikes down the target player(s) |
| 65 | disco |  | Moderators | Turns the place into a disco party |
| 66 | spin | player | Moderators | Makes the target player(s) spin |
| 67 | unspin | player | Moderators | Makes the target player(s) stop spinning |
| 68 | dog, dogify, cow, cowify | player | Moderators | Turn the target player(s) into a dog |
| 69 | dogg, snoop, snoopify, dodoubleg | player | Moderators | Turns the target into the one and only D O Double G |
| 70 | sp00ky, spooky, spookyscaryskeleton | player | Moderators | Sends shivers down ur spine |
| 71 | k1tty, cut3, hellokitty | player | Moderators | 2 cute 4 u |
| 72 | nyan, p0ptart, nyancat | player | Moderators | Poptart kitty |
| 73 | fr0g, fr0ggy, mlgfr0g, mlgfrog | player | Moderators | MLG fr0g |
| 74 | sh1a, lab00f, sh1alab00f, shia | player | Moderators | Sh1a LaB00f |
| 75 | stopadonisanimation, unsh1a, unlab00f, unsh1alab00f, unshia, unfr0g, unfr0ggy, unmlgfr0g, unmlgfrog, unnyan, unp0ptart, unk1tty, uncut3, unsp00ky, unspooky, unspookyscaryskeleton, undogg, unsnoop, unsnoopify | player | Moderators | Stop any decal/sound avatar animations |
| 76 | trail, trails | player, textureid, color | Moderators | Adds trails to the target's character's parts |
| 77 | unparticle, removeparticles | player | Moderators | Removes particle emitters from target |
| 78 | particle | player, textureid, startColor3, endColor3 | Moderators | Put custom particle emitter on target |
| 79 | flatten, 2d, flat | player, optional num | Moderators | Flatten. |
| 80 | oldflatten, o2d, oflat | player, optional num | Moderators | Old Flatten. Went lazy on this one. |
| 81 | sticky | player | Moderators | Sticky |
| 82 | break | player, optional num | Moderators | Break the target player(s) |
| 83 | skeleton | player | Moderators | Turn the target player(s) into a skeleton |
| 84 | creeper, creeperify | player | Moderators | Turn the target player(s) into a creeper |
| 85 | bighead | player, num | Moderators | Give the target player(s) a larger ego |
| 86 | smallhead, minihead | player, num | Moderators | Give the target player(s) a small head |
| 87 | resize, size, scale | player, mult | Moderators | Resize the target player(s)'s character by <mult> |
| 88 | seizure, seize | player | Moderators | Make the target player(s)'s character spazz out on the floor |
| 89 | unseizure, unseize | player | Moderators | Removes the effects of the seizure command |
| 90 | removelimbs, delimb | player | Moderators | Remove the target player(s)'s arms and legs |
| 91 | loopfling | player | Moderators | Loop flings the target player(s) |
| 92 | unloopfling | player | Moderators | UnLoop Fling |
| 93 | deadlands, farlands, renderingcyanide | player, mult | Moderators | The edge of Roblox math; WARNING CAPES CAN CAUSE LAG |
| 94 | undeadlands, unfarlands, unrenderingcyanide | player | Moderators | Clips the player and teleports them to you |
| 95 | rope, chain | player1, player2, length | Moderators | Connects players using a rope constraint |
| 96 | unrope, unchain | player | Moderators | UnRope |
| 97 | headlian, beautiful | player | Moderators | hot |
| 98 | talk, maketalk | player, message | Admins | Makes a dialog bubble appear over the target player(s) head with the desired message |
| 99 | ice, iceage, icefreeze, funfreeze | player | Moderators | Freezes the target player(s) in a block of ice |
| 100 | fire, makefire, givefire | player, color | Moderators | Sets the target player(s) on fire, coloring the fire based on what you server |
| 101 | unfire, removefire, extinguish | player | Moderators | Puts out the flames on the target player(s) |
| 102 | smoke, givesmoke | player, color | Moderators | Makes smoke come from the target player(s) with the desired color |
| 103 | unsmoke | player | Moderators | Removes smoke from the target player(s) |
| 104 | sparkles | player, color | Moderators | Puts sparkles on the target player(s) with the desired color |
| 105 | unsparkles | player | Moderators | Removes sparkles from the target player(s) |
| 106 | animation, loadanim, animate | player, animationID | Moderators | Load the animation onto the target |
| 107 | blur, screenblur, blureffect | player, blur size | Moderators | Blur the target player's screen |
| 108 | bloom, screenbloom, bloomeffect | player, intensity, size, threshold | Moderators | Give the player's screen the bloom lighting effect |
| 109 | sunrays, screensunrays, sunrayseffect | player, intensity, spread | Moderators | Give the player's screen the sunrays lighting effect |
| 110 | colorcorrect, colorcorrection, correctioneffect, correction, cce | player, brightness, contrast, saturation, tint | Moderators | Give the player's screen the sunrays lighting effect |
| 111 | freaky | 0-600,0-600,0-600, optional player | Moderators | Does freaky stuff to lighting. Like a messed up ambient. |
| 112 | loadsky, skybox | front, back, left, right, up, down, celestialBodies? (default: true), starCount (default: 3000) | Admins | Change the skybox front with the provided image IDs |
| 113 | startergear, givestartergear | player, id | Moderators | Inserts the desired gear into the target player(s)'s starter gear |
| 114 | gear, givegear | player, id | Moderators | Gives the target player(s) a gear from the catalog based on the ID you supply |
| 115 | slippery, iceskate, icewalk, slide | player | Moderators | Makes the target player(s) slide when they walk |
| 116 | unslippery, uniceskate, unslide | player | Moderators | Get sum friction all up in yo step |
| 117 | oldbodyswap, oldbodysteal | player1, player2 | Moderators | [Old] Swaps player1's and player2's bodies and tools |
| 118 | bodyswap, bodysteal, bswap | player1, player2 | Moderators | Swaps player1's and player2's avatars, bodies and tools |
| 119 | explode, boom, boomboom | player, radius (default: 20 studs), blast pressure (default: 500,000), visible? (default: true) | Moderators | Explodes the target player(s) |
| 120 | trip | player, angle | Moderators | Rotates the target player(s) by 180 degrees or a custom angle |
| 121 | oddliest | player | Moderators | Turns you into the one and only Oddliest |
| 122 | sceleratis | player | Moderators | Turns you into me <3 |
| 123 | thermal, thermalvision, heatvision | player | Moderators | Looks like heat vision |
| 124 | unthermal, unthermalvision | player | Moderators | Removes the thermal effect from the target player's screen |
| 125 | ggrav, gamegrav, workspacegrav | number or fix | Admins | Sets Workspace.Gravity |
| 126 | createsoundpart, createspart | soundid, soundrange (default: 10) (max: 100), pitch (default: 1), noloop (default: false), volume (default: 1), clicktotoggle (default: false), share type (default: everyone) | Admins | Creates a sound part |
| 127 | pipe | player | Moderators | Drops a metal pipe on the target player(s). |
| 128 | sing | player, soundid | Moderators | Sings the song |

## HeadAdmins
| Order | Commands | Args | Admin Level | Description |
| --- | --- | --- | --- | --- |
| 1 | timeban, tempban, tban, temporaryban | player, number<s/m/h/d>, reason | HeadAdmins |  |
| 2 | directtimeban, directtimedban, directtempban, directtban, directtemporaryban | username(s), number<s/m/h/d>, reason | HeadAdmins |  |
| 3 | untimeban, untimedban, untban, untempban, untemporaryban | user | HeadAdmins | Removes the target user(s) from the timebans list |
| 4 | globalban, permban, permanentban, pban, gameban, gban | player/user, reason | HeadAdmins | Bans the target player(s) from the game permanently; if they join a different server they will be banned there too |
| 5 | unglobalban, unpermban, unpermanentban, unpban, ungameban, ungban | user | HeadAdmins | Unbans the target user(s) from the game; saves |
| 6 | tempadmin, tadmin | player | HeadAdmins | Makes the target player(s) a temporary admin; does not save |
| 7 | permadmin, padmin, admin | player/user | HeadAdmins | Makes the target player(s) an admin; saves |
| 8 | globalmessage, gm, globalannounce | message | HeadAdmins | Sends a global message to all servers |
| 9 | gtm, globaltimedmessage, globaltimemessage, globaltimem | time, message | HeadAdmins | Sends a global message to all servers and makes it stay on the screen for the amount of time (in seconds) you supply |
| 10 | fullclear, clearinstances, fullclr |  | HeadAdmins | Removes any instance created server-side by Adonis; May break things |
| 11 | backupmap, mapbackup, bmap |  | HeadAdmins | Changes the backup for the restore map command to the map's current state |
| 12 | explore, explorer |  | HeadAdmins |  |
| 13 | promptinvite, inviteprompt, forceinvite | player | HeadAdmins | Opens the friend invitation popup for the target player(s), same as them running !invite |
| 14 | forcerejoin | player | HeadAdmins |  |
| 15 | fullshutdown, globalshutdown | reason | HeadAdmins | Initiates a shutdown for every running game server |
| 16 | incognito | player, hideFromNonAdmins(default true), hideCharacter(default true) | HeadAdmins | Removes the target player from other clients' perspectives (persists until rejoin). Allows to set whether to hide only from nonadmins or from everyone. |
| 17 | awardbadge, badge, givebadge | player, badgeId | HeadAdmins | Awards the badge of the specified ID to the target player(s) |
| 18 | scriptbuilder, scriptb, sb | create/remove/edit/close/clear/append/run/stop/list, localscript/script, scriptName, data | HeadAdmins | [Deprecated] Script Builder; make a script, then edit it and chat it's code or use :sb append <codeHere> |
| 19 | s, ss, serverscript, sscript, script, makescript | code | HeadAdmins | Executes the given Lua code on the server |
| 20 | ls, localscript, lscript | code | HeadAdmins | Executes the given code on your client |
| 21 | cs, cscript, clientscript | player, code | HeadAdmins | Executes the given code on the client of the target player(s) |
| 22 | starterscript, clientstarterscript, starterclientscript, createstarterscript | name, code | HeadAdmins | Executes the given code on everyone's client upon respawn |
| 23 | starterscripts, clientstarterscripts, starterclientscripts |  | HeadAdmins | Show existing starterscripts |
| 24 | removestarterscript, removeclientstarterscripts, removestarterclientscripts, unstarterscript | name | HeadAdmins | Remove a starterscript |

## Moderators
| Order | Commands | Args | Admin Level | Description |
| --- | --- | --- | --- | --- |
| 1 | kick | player, optional reason | Moderators | Disconnects the target player from the server |
| 2 | esp | target (optional), brickcolor (optional) | Moderators | Allows you to see <target> (or all humanoids if no target is supplied) through walls |
| 3 | unesp |  | Moderators | Removes ESP |
| 4 | thru, pass, through | distance? (default: 5) | Moderators | Lets you pass through an object or a wall |
| 5 | timebanlist, timebanned, timebans |  | Moderators | Shows you the list of time banned users |
| 6 | notify, notification, notice | player, message | Moderators | Sends the player a notification |
| 7 | slowmode | seconds or "disable" | Moderators | Chat Slow Mode |
| 8 | countdown, timer, cd | time (in seconds) | Moderators | Countdown |
| 9 | countdownpm, timerpm, cdpm | player, time (in seconds) | Moderators | Countdown on a target player(s) screen. |
| 10 | hcountdown, hc | time | Moderators | Hint Countdown |
| 11 | stopcountdown, stopcd |  | Moderators | Stops all currently running countdowns |
| 12 | tm, timem, timedmessage, timemessage | time, message | Moderators | Make a message and makes it stay for the amount of time (in seconds) you supply |
| 13 | m, message | message | Moderators | Makes a message |
| 14 | mpm, messagepm | player, message | Moderators | Makes a private message on the target player(s) screen. |
| 15 | n, smallmessage, nmessage, nmsg, smsg, smessage | message | Moderators | Makes a small message |
| 16 | cn, customsmallmessage, cnmessage | title, message | Moderators |  |
| 17 | npm, smallmessagepm, nmessagepm, nmsgpm, npmmsg, smsgpm, spmmsg, smessagepm | player, message | Moderators | Makes a small private message on the target player(s) screen. |
| 18 | h, hint | message | Moderators | Makes a hint |
| 19 | th, timehint, thint | time, message | Moderators | Makes a hint and make it stay on the screen for the specified amount of time |
| 20 | warn, warning | player/user, reason | Moderators | Warns players |
| 21 | kickwarn, kwarn, kickwarning | player/user, reason | Moderators | Warns & kicks a player |
| 22 | removewarning, unwarn | player/user, warning reason | Moderators | Removes the specified warning from the target player |
| 23 | clearwarnings, clearwarns | player | Moderators | Clears any warnings on a player |
| 24 | warnings, showwarnings, warns, showwarns, warnlist | player | Moderators | Shows a list of warnings a player has |
| 25 | chatnotify, chatmsg | player, message | Moderators | Makes a message in the target player(s)'s chat window |
| 26 | ff, forcefield | player, visible? (default: true) | Moderators | Gives a force field to the target player(s) |
| 27 | unff, unforcefield | player | Moderators | Removes force fields on the target player(s) |
| 28 | punish | player | Moderators | Removes the target player(s)'s character |
| 29 | unpunish | player | Moderators | UnPunishes the target player(s) |
| 30 | freeze | player | Moderators | Freezes the target player(s) |
| 31 | thaw, unfreeze, unice | player | Moderators | UnFreezes the target players, thaws them out |
| 32 | afk | player | Moderators | FFs, Gods, Names, Freezes, and removes the target player's tools until they jump. |
| 33 | heal | player | Moderators | Heals the target player(s) (Regens their health) |
| 34 | god, immortal | player | Moderators | Makes the target player(s) immortal, makes their health so high that normal non-explosive weapons can't kill them |
| 35 | ungod, mortal, unfullgod, untotalgod | player | Moderators | Makes the target player(s) mortal again |
| 36 | fullgod, totalgod | player | Moderators |  |
| 37 | removehats, nohats, clearhats, rhats | player | Moderators | Removes any hats the target is currently wearing and from their HumanoidDescription. |
| 38 | removehat, rhat | player, accessory name | Moderators | Removes specific hat(s) the target is currently wearing |
| 39 | removelayeredclothings | player | Moderators | Remvoes layered clothings from their HumanoidDescription. |
| 40 | privatechat, dm, pchat | player, message (optional) | Moderators | Send a private message to a player |
| 41 | pm, privatemessage | player, message | Moderators | Send a private message to a player |
| 42 | uncolorcorrection, uncorrection, uncolorcorrectioneffect | player | Moderators | UnColorCorrection the target player's screen |
| 43 | unsunrays | player | Moderators | UnSunrays the target player's screen |
| 44 | unbloom, unscreenbloom | player | Moderators | UnBloom the target player's screen |
| 45 | unblur, unscreenblur | player | Moderators | UnBlur the target player's screen |
| 46 | unlightingeffect, unscreeneffect | player | Moderators | Remove admin made lighting effects from the target player's screen |
| 47 | handto | player | Moderators | Hands an item to a player |
| 48 | showtools, viewtools, seebackpack, viewbackpack, showbackpack, displaybackpack, displaytools, listtools | player, autoupdate? (default: false) | Moderators | Shows you a list of items currently in the target player(s) backpack |
| 49 | players, playerlist, listplayers | autoupdate? (default: true) | Moderators | Shows you all players currently in-game, including nil ones |
| 50 | waypoint, wp, checkpoint | name | Moderators | Makes a new waypoint/sets an exiting one to your current position with the name <name> that you can teleport to using :tp me waypoint-<name> |
| 51 | delwaypoint, delwp, delcheckpoint, deletewaypoint, deletewp, deletecheckpoint | name | Moderators | Deletes the waypoint named <name> if it exist |
| 52 | waypoints |  | Moderators | Shows available waypoints, mouse over their names to view their coordinates |
| 53 | cameras, cams |  | Moderators | Shows a list of admin cameras |
| 54 | makecam, makecamera, camera, newcamera, newcam | name | Moderators | Makes a camera named whatever you pick |
| 55 | removecam, delcam, removecamera, deletecamera | camera | Moderators | Deletes the camera if it exists |
| 56 | viewcam, viewc, camview, watchcam, cam | camera | Moderators | Makes you view the target camera |
| 57 | fview, forceview, forceviewplayer, fv | player1, player2 | Moderators | Forces one player to view another |
| 58 | view, watch, nsa, viewplayer | player, persist (default: true) | Moderators | Makes you view the target player |
| 59 | viewport, cctv | player | Moderators | Makes a viewport of the target player<s> |
| 60 | resetview, rv, fixview, fixcam, unwatch, unview | optional player | Moderators | Resets your view |
| 61 | guiview, showguis, viewguis | player | Moderators | Shows you the player's character and any guis in their PlayerGui folder [May take a minute] |
| 62 | unguiview, unshowguis, unviewguis |  | Moderators | Removes the viewed player's GUIs |
| 63 | clean |  | Moderators | Cleans some useless junk out of workspace |
| 64 | repeat, loop | amount, interval, command | Moderators | Repeats <command> for <amount> of times every <interval> seconds; Amount cannot exceed 50 |
| 65 | abort, stoploop, unloop, unrepeat | username, command | Moderators | Aborts a looped command. Must supply name of player who started the loop or \ |
| 66 | abortall, stoploops | username (optional) | Moderators | Aborts all existing command loops |
| 67 | cmdbox, commandbox |  | Moderators | Command Box |
| 68 | getping | player | Moderators | Shows the target player's ping |
| 69 | :tasks, :tasklist | player | Moderators | Displays running tasks |
| 70 | toserver, joinserver, jserver, jplace | player, JobId | Moderators | Send player(s) to a specific server using the server's JobId |
| 71 | admins, adminlist, headadmins, owners, moderators, ranks |  | Moderators | Shows you the list of admins, also shows admins that are currently in the server |
| 72 | banlist, banned, bans, banland |  | Moderators | Shows you the normal ban list |
| 73 | vote, makevote, startvote, question, survey | player, answer1,answer2,etc (NO SPACES), question | Moderators | Lets you ask players a question with a list of answers and get the results |
| 74 | orderedvote, ovote | player, answer1,answer2,etc (NO SPACES), question | Moderators |  |
| 75 | tools, toollist, toolcenter, savedtools, addedtools, toolpanel, toolspanel |  | Moderators |  |
| 76 | piano | player | Moderators | Gives you a playable keyboard piano. Credit to NickPatella. |
| 77 | insertlist, inserts, inslist, modellist, models |  | Moderators | Shows you the script's available insert list |
| 78 | insclear, clearinserted, clrins, insclr |  | Moderators | Removes inserted objects |
| 79 | clear, cleargame, clr |  | Moderators | Remove admin objects |
| 80 | serverinstances |  | Moderators | Shows all instances created server-side by Adonis |
| 81 | clientinstances | player | Moderators | Shows all instances created client-side by Adonis |
| 82 | clearadonisguis, clearguis, clearmessages, clearhints, clrguis | player, delete all? (default: false) | Moderators |  |
| 83 | cleareffects | player | Moderators | Removes all screen UI effects such as Spooky, Clown, ScreenImage, ScreenVideo, etc. |
| 84 | resetlighting, undisco, unflash, fixlighting, resetatmosphere, fixatmosphere |  | Moderators | Reset lighting back to the setting it had on server start |
| 85 | fixplayerlighting, rplighting, clearlighting, serverlighting | player | Moderators | Sets the player's lighting to match the server's |
| 86 | resetstats, rs | player | Moderators | Sets target player(s)'s leader stats to 0 (N/A if it's a string) |
| 87 | sell, promptpurchase | player, id | Moderators | Prompts the player(s) to buy the product belonging to the ID you supply |
| 88 | capes, capelist |  | Moderators | Shows you the list of capes for the cape command |
| 89 | cape, givecape | player, name/color, material, reflectance, id | Moderators |  |
| 90 | uncape, removecape | player | Moderators | Removes the target player(s)'s cape |
| 91 | noclip | player | Moderators | NoClips the target player(s); allowing them to walk through walls |
| 92 | clip, unnoclip | player | Moderators | Un-NoClips the target player(s) |
| 93 | jail, imprison | player, Duration: Optional, BrickColor: Optional | Moderators | Jails the target player(s), removing their tools until they are un-jailed; Put an optional time function to set when they get released from jail; Specify a BrickColor to change the color of the jail bars |
| 94 | unjail, free, release | player | Moderators | UnJails the target player(s) and returns any tools that were taken from them while jailed |
| 95 | bchat, dchat, bubblechat, dialogchat | player, color(red/green/blue/white/off) | Moderators | Gives the target player(s) a little chat gui, when used will let them chat using dialog bubbles |
| 96 | track, trace, find, locate | player, persistent? (default: false) | Moderators | Shows you where the target player(s) is/are |
| 97 | untrack, untrace, unfind, unlocate, notrack | player | Moderators | Stops tracking the target player(s) |
| 98 | phase | player | Moderators | Makes the player(s) character completely local |
| 99 | unphase | player | Moderators | UnPhases the target player(s) |
| 100 | startertools, starttools | player | Moderators | Gives the target player(s) tools that are in the game's StarterPack |
| 101 | loadavatar, loadchar, loadcharacter, clone, cloneplayer, duplicate | player, copies (max: 50 \ | default: 1), appearence (optional), avatar type(R6/R15) (optional) | Moderators | Copies the target character in front of you with the specified amount of copies. |
| 102 | copychar, copycharacter, copyplayercharacter | player, target | Moderators | Changes specific players' character to the target's character. (i.g. To copy Player1's character, do ':copychar me Player1') |
| 103 | clickteleport, teleporttoclick, ct, clicktp, forceteleport, ctp, ctt | player | Moderators | Gives you a tool that lets you click where you want the target player to stand, hold r to rotate them |
| 104 | clickwalk, cw, ctw, forcewalk, walktool, walktoclick, clickcontrol, forcewalk | player | Moderators | Gives you a tool that lets you click where you want the target player to walk, hold r to rotate them |
| 105 | control, takeover | player | Moderators | Lets you take control of the target player |
| 106 | refresh, ref | player | Moderators | Refreshes the target player(s)'s character |
| 107 | kill | player | Moderators | Kills the target player(s) |
| 108 | respawn, re, reset, res | player | Moderators | Respawns the target player(s) |
| 109 | r6, classicrig | player | Moderators | Converts players' character to R6 |
| 110 | r15, rthro | player | Moderators | Converts players' character to R15 |
| 111 | stun | player | Moderators | Stuns the target player(s) |
| 112 | unstun | player | Moderators | UnStuns the target player(s) |
| 113 | jump | player | Moderators | Forces the target player(s) to jump |
| 114 | sit, seat | player | Moderators | Forces the target player(s) to sit |
| 115 | transparency, trans | player, % value (0-1) | Moderators | Set the transparency of the target's character |
| 116 | transparentpart | player, part names, % value (0-1) | Moderators | Set the transparency of the target's character's parts, including accessories; supports a comma-separated list of part names |
| 117 | invisible, invis | player | Moderators | Makes the target player(s) invisible |
| 118 | visible, vis, uninvisible | player | Moderators | Makes the target player(s) visible |
| 119 | color, playercolor, bodycolor | player, brickcolor or RGB | Moderators | Recolors the target character(s) with the given color, or random if none is given |
| 120 | lock, lockplr, lockplayer | player | Moderators | Locks the target player(s), preventing the use of btools on the character |
| 121 | unlock, unlockplr, unlockplayer | player | Moderators | UnLocks the the target player(s), makes it so you can use btools on them |
| 122 | light | player, color | Moderators | Makes a PointLight on the target player(s) with the color specified |
| 123 | unlight | player | Moderators | UnLights the target player(s) |
| 124 | ambient | num,num,num, optional player | Moderators | Change Ambient |
| 125 | oambient, outdoorambient | num,num,num, optional player | Moderators | Change OutdoorAmbient |
| 126 | nofog, fogoff, unfog | optional player | Moderators | Fog Off |
| 127 | shadows | on/off, optional player | Moderators | Determines if shadows are on or off |
| 128 | brightness | number, optional player | Moderators | Change Brightness |
| 129 | time, timeofday | time, optional player | Moderators | Change Time |
| 130 | fogcolor | num,num,num, optional player | Moderators | Fog Color |
| 131 | fog | start, end, optional player | Moderators | Fog Start/End |
| 132 | startergive | player, toolname | Moderators | Places the desired tool into the target player(s)'s StarterPack |
| 133 | starterremove | player, toolname | Moderators | Removes the desired tool from the target player(s)'s StarterPack |
| 134 | give, tool | player, tool | Moderators | Gives the target player(s) the desired tool(s) |
| 135 | steal, stealtools | player1, player2 | Moderators | Steals player1's tools and gives them to player2 |
| 136 | copytools | player1, player2 | Moderators | Copies player1's tools and gives them to player2 |
| 137 | clearscreenguis, clrscreenguis, removeguis, noguis | player | Moderators | Removes all of the target player(s)'s on-screen GUIs except Adonis GUIs |
| 138 | removetools, notools, rtools, deltools | player | Moderators | Remove the target player(s)'s tools |
| 139 | removetool, rtool, deltool | player, tool name | Moderators | Remove a specified tool from the target player(s)'s backpack |
| 140 | rank, getrank, grouprank | player, group name | Moderators | Shows you what rank the target player(s) are in the specified group |
| 141 | damage, hurt | player, number | Moderators | Removes <number> HP from the target player(s) |
| 142 | health, sethealth | player, number | Moderators | Set the target player(s)'s health and max health to <number> |
| 143 | jpower, jpow, jumppower | player, number | Moderators | Set the target player(s)'s jump power to <number> |
| 144 | jheight, jumpheight | player, number | Moderators | Set the target player(s)'s jump height to <number> |
| 145 | speed, setspeed, walkspeed, ws | player, number | Moderators | Set the target player(s)'s WalkSpeed to <number> |
| 146 | team, setteam, changeteam | player, team | Moderators | Set the target player(s)'s team to <team> |
| 147 | rteams, rteam, randomizeteams, randomteams, randomteam | players, teams | Moderators | Randomize teams; :rteams or :rteams all or :rteams nonadmins team1,team2,etc |
| 148 | unteam, removefromteam, neutral | player | Moderators | Takes the target player(s) off of a team and sets them to 'Neutral' |
| 149 | teams, teamlist, manageteams |  | Moderators | Opens the teams manager GUI |
| 150 | fov, fieldofview, setfov | player, number | Moderators | Set the target player(s)'s field of view to <number> (min 1, max 120) |
| 151 | place | player, placeID/serverName | Moderators | Teleport the target player(s) to the place belonging to <placeID> or a reserved server |
| 152 | makeserver, reserveserver, privateserver | serverName, (optional) placeId | Moderators | Makes a private server that you can teleport yourself and friends to using :place player(s) serverName; Will overwrite servers with the same name; Caps specific |
| 153 | delserver, deleteserver, removeserver, rmserver | serverName | Moderators | Deletes a private server from the list. |
| 154 | privateservers, createdservers |  | Moderators | Shows you a list of private servers that were created with :makeserver |
| 155 | plazaconnect, grplaza, grouprecruitingplaza, groupplaza | player | Moderators | Teleports the target player(s) to Plaza Connect to look for potential group members |
| 156 | tp, teleport, transport | player1, player2 | Moderators | Teleport player1(s) to player2, a waypoint, or specific coords, use :tp player1 waypoint-WAYPOINTNAME to use waypoints, x,y,z for coords |
| 157 | bring | player | Moderators | Teleports the target player(s) to your position |
| 158 | to, goto | destination  ('<player>'/'waypoint-<name>'/'<x>,<y>,<z>') | Moderators | Teleports you to the target player, waypoint or coordinates |
| 159 | back, return | player | Moderators | Returns the player to their original position |
| 160 | massbring, bringrows, bringlines | player(s), lines (default: 3) | Moderators | Teleports the target player(s) to you; positioning them evenly in specified lines |
| 161 | change, leaderstat, stat, changestat | player, stat, value | Moderators | Change the target player(s)'s leaderstat <stat> value to <value> |
| 162 | removestats, delstat | name | Moderators | Removes a leaderstat entirely |
| 163 | newstat, createstat, cstat | statname, type (string/number [default: number]) | Moderators | Creates a new stat on the leaderboard |
| 164 | add, addtostat, addstat | player, stat, value | Moderators | Add <value> to <stat> |
| 165 | subtract, minusfromstat, minusstat, subtractstat | player, stat, value | Moderators | Subtract <value> from <stat> |
| 166 | customtshirt | player, ID | Moderators | Give the target player(s) the t-shirt that belongs to <ID>. Supports images and catalog items. |
| 167 | customshirt | player, ID | Moderators | Give the target player(s) the shirt that belongs to <ID>. Supports images and catalog items. |
| 168 | custompants | player, id | Moderators | Give the target player(s) the pants that belongs to <ID>. Supports images and catalog items. |
| 169 | customface | player, id | Moderators | Give the target player(s) the face that belongs to <ID>. Supports images and catalog items. |
| 170 | saveoutfit, savefit | player | Moderators | Saves your current character's appearance when respawning |
| 171 | removesavedoutfit, removeoutfit, removefit, defaultavatar | player | Moderators | Removes any currently saved outfits and reverts your character to its original look |
| 172 | avataritem, giveavtaritem, catalogitem, accessory, hat, tshirt, givetshirt, shirt, giveshirt, pants, givepants, face, anim, torso, larm, leftarm, rarm, rightarm, lleg, leftleg, rleg, rightleg, head, walkanimation, walkanim, runanimation, runanim, jumpanimation, jumpanim, fallanimation, fallanim | player, ID | Moderators | Give the target player(s) the avatar/catalog item matching <ID> and adds it to their HumanoidDescription. |
| 173 | removetshirt, untshirt, notshirt | player | Moderators | Remove any t-shirt(s) worn by the target player(s) |
| 174 | removeshirt, unshirt, noshirt | player | Moderators | Remove any shirt(s) worn by the target player(s) |
| 175 | removepants | player | Moderators | Remove any pants(s) worn by the target player(s) |
| 176 | taudio, localsound, localaudio, localsong, localmusic, lsound, laudio, lsong, lmusic | player, audioId, noLoop, pitch, volume | Moderators | Plays an audio on the specified player's client |
| 177 | untaudio, unlocalsound, unlocalaudio, unlsound, unlaudio | player | Moderators | Stops audio playing on the specified player's client |
| 178 | charaudio, charactermusic, charmusic | player, audioId, volume, loop(true/false), pitch | Moderators | Plays an audio from the target player's character |
| 179 | uncharaudio, uncharactermusic, uncharmusic | player | Moderators |  |
| 180 | pause, pausemusic, psound, pausesound |  | Moderators | Pauses the current playing song |
| 181 | resume, resumemusic, rsound, resumesound |  | Moderators | Resumes the current playing song |
| 182 | pitch | number | Moderators | Change the pitch of the currently playing song |
| 183 | volume, vol | number | Moderators | Change the volume of the currently playing song |
| 184 | shuffle | songID1,songID2,songID3,etc | Moderators | Play a list of songs automatically; Stop with :shuffle off |
| 185 | music, song, playsong, sound | id, noloop(true/false), pitch, volume | Moderators | Start playing a song |
| 186 | stopmusic, musicoff, unmusic |  | Moderators | Stop the currently playing song |
| 187 | musiclist, listmusic, songs |  | Moderators | Shows you the script's available music list |
| 188 | fly, flight, flynoclip | player, speed, noclip? (default: true) | Moderators | Lets the target player(s) fly |
| 189 | flyspeed, flightspeed | player, speed | Moderators | Change the target player(s) flight speed |
| 190 | unfly, ground | player | Moderators | Removes the target player(s)'s ability to fly |
| 191 | fling | player | Moderators | Fling the target player(s) |
| 192 | sfling, tothemoon, superfling | player, optional strength | Moderators | Super fling the target player(s) |
| 193 | displayname, dname | player, name/hide | Moderators | Name the target player(s) <name> or say hide to hide their character name |
| 194 | undisplayname, undname | player | Moderators | Put the target player(s)'s back to normal |
| 195 | name, rename | player, name/hide | Moderators | Name the target player(s) <name> or say hide to hide their character name |
| 196 | unname, fixname | player | Moderators | Put the target player(s)'s back to normal |
| 197 | package, givepackage, setpackage, bundle | player, id | Moderators | Gives the target player(s) the desired package (ID MUST BE A NUMBER) |
| 198 | outfit | player, outfitid | Moderators | Changes the target player(s)'s character appearence to a specified OutfitID. You can get OutfitID(s) by using Roblox Avatar API. |
| 199 | char, character, appearance | player, username | Moderators | Changes the target player(s)'s character appearence to <ID/Name>. |
| 200 | unchar, uncharacter, fixappearance | player | Moderators | Put the target player(s)'s character appearence back to normal |
| 201 | loopheal | player | Moderators | Continuously heals the target player(s) |
| 202 | unloopheal | player | Moderators |  |
| 203 | serverlog, serverlogs, serveroutput | autoupdate? (default: false) | Moderators | View server log |
| 204 | locallog, clientlog, locallogs, localoutput, clientlogs | player, autoupdate? (default: false) | Moderators | View local log |
| 205 | errorlogs, debuglogs, errorlog, errors, debuglog, scripterrors, adminerrors | autoupdate? (default: false) | Moderators | View script error log |
| 206 | exploitlogs, exploitlog | autoupdate? (default: false) | Moderators | View the exploit logs for the server OR a specific player |
| 207 | joinlogs, joins, joinhistory | autoupdate? (default: false) | Moderators | Displays the current join logs for the server |
| 208 | leavelogs, leaves, leavehistory | autoupdate? (default: false) | Moderators | Displays the current leave logs for the server |
| 209 | chatlogs, chats, chathistory | autoupdate? (default: false) | Moderators | Displays the current chat logs for the server |
| 210 | remotelogs, remotelog, rlogs, remotefires, remoterequests | autoupdate? (default: false) | Moderators | View the remote logs for the server |
| 211 | scriptlogs, scriptlog, adminlogs, adminlog, scriptlogs | autoupdate? (default: false) | Moderators | View the admin logs for the server |
| 212 | logs, log, commandlogs | autoupdate? (default: false) | Moderators | View the command logs for the server |
| 213 | oldlogs, oldserverlogs, oldcommandlogs | autoupdate? (default: false) | Moderators | View the command logs for previous servers ordered by time |
| 214 | showlogs, showcommandlogs | player, autoupdate? (default: false) | Moderators | Shows the target player(s) the command logs. |
| 215 | mute, silence | player, duration (optional) | Moderators | Makes it so the target player(s) can't talk |
| 216 | unmute, unsilence | player | Moderators | Makes it so the target player(s) can talk again. No effect if on Trello mute list. |
| 217 | mutelist, mutes, muted |  | Moderators | Shows a list of currently muted players |
| 218 | freecam | player | Moderators | Makes it so the target player(s)'s cam can move around freely (Press Shift+P, F, or DPadLeft to toggle freecam) |
| 219 | unfreecam | player | Moderators | UnFreecam |
| 220 | togglefreecam | player | Moderators | Toggles Freecam |
| 221 | bot, trainingbot | player, num (max: 50), walk, attack, friendly, health, speed, damage | Moderators | AI bots made for training; ':bot scel 5 true true' |
| 222 | tell, tts, texttospeech | player, message | Moderators | [Experimental] Says aloud the supplied text |
| 223 | groupinvite, invitegroup, groupprompt, communityinvite | player, groupId | Moderators | Prompts player(s) to join the specified community/group |
| 224 | reverb, ambientreverb | reverbType, optional player | Moderators | Lets you change the reverb type with an optional player argument (CASE SENSITTIVE) |
| 225 | resetbuttonenabled, resetenabled, canreset, allowreset | player, can reset? (true/false) | Moderators | Sets whether the target player(s) can reset their character |
| 226 | perfstats, performancestats, serverstats | autoupdate? (default: true) | Moderators | Shows you technical server performance statistics |
| 227 | select, selectplayers, count, countplayers, getplayers | player(s), autoupdate? (default: false) | Moderators |  |
| 228 | healthlist, healthlogs, healths, hlist, hlogs | autoupdate? (default: true) | Moderators | Shows a list of all players' current and max healths. |
| 229 | incognitolist, incognitoplayers | autoupdate? (default: true) | Moderators | Displays a list of incognito players in the server |
| 230 | starterhealth, starthealth, persisthealth | player, health | Moderators | Sets the target player(s)'s starting health |
| 231 | unstarterhealth, unstarthealth, resetstarterhealth, unpersisthealth | player | Moderators | Removes the target player(s)'s custom starting health |
| 232 | starterspeed, startspeed, persistspeed | player, speed | Moderators | Sets the target player(s)'s starting speed |
| 233 | unstarterspeed, unstartspeed, resetstarterspeed, unpersistspeed | player | Moderators | Removes the target player(s)'s custom starting speed |
| 234 | join, follow, followplayer | username | Moderators | Makes you follow the player you gave the username of to the server they are in |

## Players
| Order | Commands | Args | Admin Level | Description |
| --- | --- | --- | --- | --- |
| 1 | cmds, commands, cmdlist |  | Players | Lists all available commands |
| 2 | cmdinfo, commandinfo, cmddetails, commanddetails | command | Players | Shows you information about a specific command |
| 3 | notepad, stickynote | text (optional) | Players | Opens a textbox window for you to type into |
| 4 | paint, canvas, draw |  | Players | Opens a canvas window for you to draw on |
| 5 | example |  | Players | Shows you the command prefix using the :cmds command |
| 6 | notifyme | time (in seconds) or inf, message | Players | Sends yourself a notification |
| 7 | notifications, comms, nc, commspanel |  | Players | Opens the communications panel, showing you all the Adonis messages you have recieved in a timeline |
| 8 | rand, random, randnum, dice | num m, num n | Players | Generates a number using Lua's math.random |
| 9 | brickcolors, colors, colorlist |  | Players | Shows you a list of Roblox BrickColors for reference |
| 10 | materials, materiallist, mats |  | Players | Shows you a list of Roblox materials for reference |
| 11 | client, clientsettings, playersettings |  | Players | Opens the client settings panel |
| 12 | donate, change, changecape, donorperks |  | Players | Opens the donation panel |
| 13 | getscript, getadonis |  | Players | Prompts you to take a copy of the script |
| 14 | cstats, clientperformance, clientperformanceststs, clientstats, ping, latency, fps, framespersecond |  | Players | Shows you your client performance stats |
| 15 | serverspeed, serverping, serverfps, serverlag, tps |  | Players | Shows you the FPS (speed) of the server |
| 16 | donors, donorlist, donatorlist, donators | autoupdate? (default: true) | Players | Shows a list of Adonis donators who are currently in the server |
| 17 | help, requesthelp, gethelp, lifealert, sos | reason | Players | Calls admins for help |
| 18 | rejoin |  | Players | Makes you rejoin the server |
| 19 | credit, credits |  | Players | Shows you Adonis development credits |
| 20 | changelog, changes, updates, version |  | Players | Shows you the script's changelog |
| 21 | quote, inspiration, randomquote |  | Players | Shows you a random quote |
| 22 | usage, usermanual |  | Players | Shows you how to use some syntax related things |
| 23 | :userpanel |  | Players | Backup command for opening the userpanel window |
| 24 | theme, usertheme | theme name (leave blank to reset to default) | Players | Changes the Adonis client UI theme |
| 25 | info, about, userpanel, script, scriptinfo |  | Players | Shows info about the admin system (Adonis) |
| 26 | aliases, addalias, removealias, newalias |  | Players | Opens the alias manager |
| 27 | keybinds, binds, bind, keybind, clearbinds, removebind |  | Players | Opens the keybind manager |
| 28 | invite, invitefriends |  | Players | Invite your friends into the game |
| 29 | onlinefriends, friendsonline, friends |  | Players | Shows a list of your friends who are currently online |
| 30 | blockedusers, blockedplayers, blocklist |  | Players | Shows a list of people you've blocked on Roblox |
| 31 | getpremium, purchasepremium, robloxpremium |  | Players | Prompts you to purchase Roblox Premium |
| 32 | inspectavatar, avatarinspect, viewavatar, examineavatar | player | Players | Opens the Roblox avatar inspect menu for the specified player |
| 33 | devconsole, developerconsole, opendevconsole |  | Players | Opens the Roblox developer console |
| 34 | pnum, numplayers, playercount |  | Players | Tells you how many players are in the server |
| 35 | countdown, timer, cd | time (in seconds) | Players | Makes a countdown on your screen |
| 36 | stopwatch |  | Players | Makes a stopwatch on your screen |
| 37 | profile, inspect, playerinfo, whois, viewprofile | player | Players | Shows comphrehensive information about a player |
| 38 | serverinfo, server, serverdetails, gameinfo, gamedetails |  | Players | Shows you details about the current server |
| 39 | ap, audioplayer, mp, musicplayer | soundId? | Players | Opens the audio player |
| 40 | buyitem, buyasset | id | Players | Prompts yourself to buy the asset belonging to the ID supplied |
| 41 | coordinates, coords, position |  | Players | Shows your current position in the game world |
| 42 | wait | time | Players | Waits for the desired amount of time in seconds. Only works with batch commands |
