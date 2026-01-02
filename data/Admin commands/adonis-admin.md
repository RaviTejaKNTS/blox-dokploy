# Adonis Admin Commands
Source: https://github.com/Epix-Incorporated/Adonis (commit c682303f72414f453a4825cb4f7ab737838c66b5, accessed 2026-01-02)
Default Prefixes: :, ; (Player Prefix: !)
Generated: 2026-01-02

## Admins
| Commands | Args | Admin Level | Description |
| --- | --- | --- | --- |
| setrank, permrank, permsetrank | player/user, rank | Admins | Sets the admin rank of the target user(s); THIS SAVES! |
| settemprank, temprank, tempsetrank | player, rank | Admins |  |
| setlevel, setadminlevel | player, level | Admins | Sets the target player(s) permission level for the current server; does not save |
| unadmin, unmod, unowner, unpadmin, unheadadmin, unrank | player/user / list entry, temp? (true/false) (default: false) | Admins | Removes admin/moderator ranks from the target player(s); saves unless <temp> is 'true' |
| tempunadmin, untempadmin, tunadmin, untadmin | player | Admins | Removes the target players' admin powers for this server; does not save |
| tempmod, tmod, tempmoderator, tmoderator | player | Admins | Makes the target player(s) a temporary moderator; does not save |
| permmod, pmod, mod, moderator, pmoderator | player/user | Admins | Makes the target player(s) a moderator; saves |
| broadcast, bc | Message | Admins | Makes a message in the chat window |
| shutdownlogs, shutdownlog, slogs, shutdowns |  | Admins | Shows who shutdown or restarted a server and when |
| slock, serverlock, lockserver | on/off | Admins | Enables/disables server lock |
| wl, enablewhitelist, whitelist | on/off/add/remove/list/clear, optional player | Admins | Enables/disables the server whitelist; :wl username to add them to the whitelist |
| sn, systemnotify, sysnotif, sysnotify, systemsmallmessage, snmessage, snmsg, ssmsg, ssmessage | message | Admins | Makes a system small message |
| setmessage, notif, setmsg, permhint | message OR off | Admins | Sets a small hint message at the top of the screen |
| setbanmessage, setbmsg | message | Admins | Sets the ban message banned players see |
| setlockmessage, slockmsg, setlmsg | message | Admins | Sets the lock message unwhitelisted players see if :whitelist or :slock is on |
| sm, systemmessage, sysmsg | message | Admins | Same as message but says SYSTEM MESSAGE instead of your name, or whatever system message title is server to... |
| setcoreguienabled, setcoreenabled, showcoregui, setcoregui, setcgui, setcore, setcge | player, All/Backpack/Chat/EmotesMenu/Health/PlayerList, true/false | Admins | Enables or disables CoreGui elements for the target player(s) |
| alert, alarm, annoy | player, message | Admins | Get someone's attention |
| lockmap |  | Admins | Locks the map |
| unlockmap |  | Admins | Unlocks the map |
| btools, f3x, buildtools, buildingtools, buildertools | player | Admins | Gives the target player(s) F3X building tools. |
| insert, ins | id | Admins | Inserts whatever object belongs to the ID you supply, the object must be in the place owner's or Roblox's inventory |
| addtool, savetool, maketool | optional player, optional new tool name | Admins |  |
| clraddedtools, clearaddedtools, clearsavedtools, clrsavedtools |  | Admins |  |
| newteam, createteam, maketeam | name, BrickColor | Admins | Make a new team with the specified name and color |
| removeteam, deleteteam | name | Admins | Remove the specified team |
| restoremap, maprestore, rmap |  | Admins | Restore the map to the the way it was the last time it was backed up |
| note, writenote, makenote | player, note | Admins | Makes a note on the target player(s) that says <note> |
| removenote, remnote, deletenote, clearnote | player, note (specify 'all' to delete all notes) | Admins | Removes a note on the target player(s) |
| notes, viewnotes | player | Admins | Views notes on the target player(s) |
| loopkill | player, num (optional) | Admins | Repeatedly kills the target player(s) |
| unloopkill | player | Admins | Un-Loop Kill |
| lag, fpslag | player | Admins | Makes the target player(s)'s FPS drop |
| unlag, unfpslag | player | Admins | Un-Lag |
| crash | player | Admins | Crashes the target player(s) |
| hardcrash | player | Admins | Hard-crashes the target player(s) |
| ramcrash, memcrash | player | Admins | RAM-crashes the target player(s) |
| gpucrash | player | Admins | GPU crashes the target player(s) |
| ckick, customkick, customcrash | player, title, message | Admins | Disconnects (crashes) the target player with a custom Roblox dialog |
| shutdown | reason | Admins | Shuts the server down |
| serverban, ban | player/user, reason | Admins | Bans the target player(s) from the server |
| unserverban, unban | user | Admins | Unbans the target user(s) from the server |
| banmenu |  | Admins | Opens the ban menu |
| cm, custommessage | Upper message, message | Admins | Same as message but says whatever you want upper message to be instead of your name. |
| nil | player | Admins |  |
| promptpremiumpurchase, premiumpurchaseprompt | player | Admins | Opens the Roblox Premium purchase prompt for the target player(s) |
| rbxnotify, robloxnotify, robloxnotif, rblxnotify, rnotif, rn | player, duration (seconds), text | Admins | Sends a Roblox-styled notification for the target player(s) |
| disguise, masquerade | player, username | Admins | Names the player, chars the player, and modifies the player's chat tag |
| undisguise, removedisguise, cleardisguise, nodisguise | player | Admins | Removes the player's disguise |

## Creators
| Commands | Args | Admin Level | Description |
| --- | --- | --- | --- |
| directban | username(s), reason | Creators | Adds the specified user(s) to the global ban list; saves |
| directunban, undirectban | username(s) | Creators | Removes the specified user(s) from the global ban list; saves |
| globalplace, gplace, globalforceplace | placeId | Creators | Force all game-players to teleport to a desired place |
| forceplace | player, placeId/serverName | Creators | Force the target player(s) to teleport to the desired place |
| :adonissettings |  | Creators | Opens the Adonis settings management interface |
| headadmin, owner, hadmin, oa | player | Creators | Makes the target player(s) a HeadAdmin; Saves |
| tempheadadmin, tempowner, toa, thadmin | player | Creators | Makes the target player(s) a temporary head admin; Does not save |
| sudo | player, command | Creators | Runs a command as the target player(s) |
| clearplayerdata, clrplrdata, clearplrdata, clrplayerdata | UserId | Creators | Clears PlayerData linked to the specified UserId |
| :terminal, :console |  | Creators | Opens the debug terminal |
| scripteditor, se | new/edit/delete/run, name | Creators | Opens Script editor |
| starterscript, clientstarterscript, starterclientscript, createstarterscript | name, code | Creators | Executes the given code on everyone's client upon respawn |
| clearoldlogs, flusholdlogs |  | Creators | Clears old logs |
| taskmgr, taskmanager |  | Creators | Task manager |

## Donors
| Commands | Args | Admin Level | Description |
| --- | --- | --- | --- |
| uncape, removedonorcape |  | Donors | Remove donor cape |
| cape, donorcape |  | Donors |  |
| removetshirt, untshirt, notshirt |  | Donors | Remove the t-shirt you are wearing, if any |
| neon, donorneon | color | Donors | Changes your body material to neon and makes you the (optional) color of your choosing. |
| fire, donorfire | color (optional) | Donors | Gives you fire with the specified color (if you specify one) |
| sparkles, donorsparkles | color (optional) | Donors | Gives you sparkles with the specified color (if you specify one) |
| light, donorlight | color (optional) | Donors | Gives you a PointLight with the specified color (if you specify one) |
| particle, donorparticle | textureid, startColor3, endColor3 | Donors | Put a custom particle emitter on your character |
| unparticle, removeparticles, undonorparticle |  | Donors | Removes donor particles on you |
| unfire, undonorfire |  | Donors | Removes donor fire on you |
| unsparkles, undonorsparkles |  | Donors | Removes donor sparkles on you |
| unlight, undonorlight |  | Donors | Removes donor light on you |
| avataritem, accessory, hat, donorhat, shirt, donorshirt, tshirt, donortshirt, givetshirt, shirt, donorshirt, giveshirt, pants, donorpants, givepants, face, donorface, animation, anim | ID | Donors | Gives yourself the avatar item that belongs to <ID> |
| saveoutfit, savefit |  | Donors | Saves your current character's appearance when respawning |
| removesavedoutfit, removeoutfit, removefit, defaultavatar |  | Donors | Removes any currently saved outfits and reverts your character to its original look |
| myhats, hatlist, hats, donorhats |  | Donors | Shows you a list of hats you are currently wearing |
| removehat, removedonorhat | name | Donors | Removes a specific accessory you are currently wearing |
| removehats, nohats, nodonorhats, clearhats |  | Donors | Removes any hats you are currently wearing |

## Fun
| Commands | Args | Admin Level | Description |
| --- | --- | --- | --- |
| glitch, glitchdisorient, glitch1, glitchy | player, intensity | Moderators | Makes the target player(s)'s character teleport back and forth rapidly, quite trippy, makes bricks appear to move as the player turns their character |
| ghostglitch, glitch2, glitchghost | player, intensity | Moderators | The same as gd but less trippy, teleports the target player(s) back and forth in the same direction, making two ghost like images of the game |
| vibrate, glitchvibrate | player, intensity | Moderators | Kinda like gd, but teleports the player to four points instead of two |
| unglitch, unglitchghost, ungd, ungg, ungv, unvibrate | player | Moderators | UnGlitchs the target player(s) |
| setfps | player, fps | Admins | Sets the target players's FPS |
| restorefps, revertfps, unsetfps | player | Admins | Restores the target players's FPS |
| gerald | player | Moderators | A massive Gerald AloeVera hat. |
| ungerald | player | Moderators | De-Geraldification |
| wat |  | Players | ??? |
| trolled, freebobuc, freedonor, adminpls, enabledonor, freeadmin, hackadmin |  | Players | You've Been Trolled You've Been Trolled Yes You've Probably Been Told... |
| trigger, triggered | player | Moderators | Makes the target player really angry |
| brazil, sendtobrazil | players | Moderators | You're going to 🇧🇷. |
| chargear, charactergear, doll, cgear, playergear, dollify, pgear, plrgear | player/username, steal | Moderators | Gives you a doll of a player |
| lowres, pixelrender, pixel, pixelize | player, pixelSize, renderDist | Admins | Pixelizes the player's view |
| zawarudo, stoptime |  | Admins | Freezes everything but the player running the command |
| unzawarudo, unstoptime |  | Admins | Stops zawarudo |
| dizzy | player, speed | Admins | Causes motion sickness |
| undizzy | player | Admins | UnDizzy |
| Davey_Bones, davey | player | Moderators | Turns you into me <3 |
| boombox | player | Moderators | Gives the target player(s) a boombox |
| infect, zombify | player | Moderators | Turn the target player(s) into a suit zombie |
| rainbowify, rainbow | player | Moderators | Make the target player(s)'s character flash rainbow colors |
| unrainbowify, unrainbow | player | Moderators | Removes the rainbow effect from the player(s) specified |
| noobify, noob | player | Moderators | Make the target player(s) look like a noob |
| material, mat | player, material | Moderators | Make the target the material you choose |
| neon, neonify | player, (optional)color | Moderators | Make the target neon |
| ghostify, ghost | player | Moderators | Turn the target player(s) into a ghost |
| goldify, gold | player | Moderators | Make the target player(s) look like gold |
| shiney, shineify, shine | player | Moderators | Make the target player(s)'s character shiney |
| spook | player | Moderators | Makes the target player(s)'s screen 2spooky4them |
| thanos, thanossnap, balancetheserver, snap | player | Admins | \ |
| sword, givesword | player, allow teamkill (default: true), base dmg (default: 5), slash dmg (default: 10), lunge dmg (default: 30) | Moderators | Gives the target player(s) a sword |
| iloveyou, alwaysnear, alwayswatching |  | Players | I love you. You are mine. Do not fear; I will always be near. |
| theycome, fromanotherworld, ufo, abduct, space, newmexico, area51, rockwell | player | Admins | A world unlike our own. |
| blind | player | Moderators | Blinds the target player(s) |
| screenimage, scrimage, image | player, textureid | Moderators | Places the desired image on the target's screen |
| screenvideo, scrvid, video | player, videoid | Moderators | Places the desired video on the target's screen |
| uneffect, unimage, uneffectgui, unspook, unblind, unstrobe, untrippy, unpixelize, unlowres, unpixel, undance, unflashify, guifix, fixgui | player | Moderators | Removes any effect GUIs on the target player(s) |
| forest, sendtotheforest, intothewoods | player | Admins | Sends player to The Forest for a timeout |
| maze, sendtothemaze, mazerunner | player | Admins | Sends player to The Maze for a timeout |
| clown, yoink, youloveme, van | player | Admins | Clowns. |
| chik3n, zelith, z3lith |  | HeadAdmins | Call on the KFC dark prophet powers of chicken |
| tornado, twister | player, optional time | HeadAdmins | Makes a tornado on the target player(s) |
| nuke | player, size | Admins | Nuke the target player(s) |
| stopwildfire, removewildfire, unwildfire |  | HeadAdmins | Stops :wildfire from spreading further |
| wildfire | player | HeadAdmins | Starts a fire at the target player(s); Ignores locked parts and parts named 'BasePlate' or 'Baseplate' |
| swagify, swagger | player | Moderators | Swag the target player(s) up |
| shrek, shrekify, shrekislife, swamp | player | Moderators | Shrekify the target player(s) |
| rocket, firework | player | Moderators | Send the target player(s) to the moon! |
| dance | player | Moderators | Make the target player(s) dance |
| breakdance, fundance, lolwut | player | Moderators | Make the target player(s) break dance |
| puke, barf, throwup, vomit | player | Moderators | Make the target player(s) puke |
| poison | player | Moderators | Slowly kills the target player(s) |
| hatpets | player, number[50 MAX]/destroy | Moderators |  |
| pets | follow/float/swarm/attack, player | Players | Makes your hat pets do the specified command (follow/float/swarm/attack) |
| grav, bringtoearth | player | Moderators | Makes the target player(s)'s gravity normal |
| setgrav, gravity, setgravity | player, number | Moderators | Set the target player(s)'s gravity |
| nograv, nogravity, superjump | player | Moderators | NoGrav the target player(s) |
| bunnyhop, bhop | player | Moderators | Makes the player jump, and jump... and jump. Just like the rabbit noobs you find in sf games ;) |
| unbunnyhop | player | Moderators | Stops the forced hippity hoppening |
| freefall, skydive | player, height | Moderators | Teleport the target player(s) up by <height> studs |
| stickify, stick, stickman | player | Moderators | Turns the target player(s) into a stick figure |
| hole, sparta | player | Moderators | Sends the target player(s) down a hole |
| lightning, smite | player | Moderators | Zeus strikes down the target player(s) |
| disco |  | Moderators | Turns the place into a disco party |
| spin | player | Moderators | Makes the target player(s) spin |
| unspin | player | Moderators | Makes the target player(s) stop spinning |
| dog, dogify, cow, cowify | player | Moderators | Turn the target player(s) into a dog |
| dogg, snoop, snoopify, dodoubleg | player | Moderators | Turns the target into the one and only D O Double G |
| sp00ky, spooky, spookyscaryskeleton | player | Moderators | Sends shivers down ur spine |
| k1tty, cut3, hellokitty | player | Moderators | 2 cute 4 u |
| nyan, p0ptart, nyancat | player | Moderators | Poptart kitty |
| fr0g, fr0ggy, mlgfr0g, mlgfrog | player | Moderators | MLG fr0g |
| sh1a, lab00f, sh1alab00f, shia | player | Moderators | Sh1a LaB00f |
| stopadonisanimation, unsh1a, unlab00f, unsh1alab00f, unshia, unfr0g, unfr0ggy, unmlgfr0g, unmlgfrog, unnyan, unp0ptart, unk1tty, uncut3, unsp00ky, unspooky, unspookyscaryskeleton, undogg, unsnoop, unsnoopify | player | Moderators | Stop any decal/sound avatar animations |
| trail, trails | player, textureid, color | Moderators | Adds trails to the target's character's parts |
| unparticle, removeparticles | player | Moderators | Removes particle emitters from target |
| particle | player, textureid, startColor3, endColor3 | Moderators | Put custom particle emitter on target |
| flatten, 2d, flat | player, optional num | Moderators | Flatten. |
| oldflatten, o2d, oflat | player, optional num | Moderators | Old Flatten. Went lazy on this one. |
| sticky | player | Moderators | Sticky |
| break | player, optional num | Moderators | Break the target player(s) |
| skeleton | player | Moderators | Turn the target player(s) into a skeleton |
| creeper, creeperify | player | Moderators | Turn the target player(s) into a creeper |
| bighead | player, num | Moderators | Give the target player(s) a larger ego |
| smallhead, minihead | player, num | Moderators | Give the target player(s) a small head |
| resize, size, scale | player, mult | Moderators | Resize the target player(s)'s character by <mult> |
| seizure, seize | player | Moderators | Make the target player(s)'s character spazz out on the floor |
| unseizure, unseize | player | Moderators | Removes the effects of the seizure command |
| removelimbs, delimb | player | Moderators | Remove the target player(s)'s arms and legs |
| loopfling | player | Moderators | Loop flings the target player(s) |
| unloopfling | player | Moderators | UnLoop Fling |
| deadlands, farlands, renderingcyanide | player, mult | Moderators | The edge of Roblox math; WARNING CAPES CAN CAUSE LAG |
| undeadlands, unfarlands, unrenderingcyanide | player | Moderators | Clips the player and teleports them to you |
| rope, chain | player1, player2, length | Moderators | Connects players using a rope constraint |
| unrope, unchain | player | Moderators | UnRope |
| headlian, beautiful | player | Moderators | hot |
| talk, maketalk | player, message | Admins | Makes a dialog bubble appear over the target player(s) head with the desired message |
| ice, iceage, icefreeze, funfreeze | player | Moderators | Freezes the target player(s) in a block of ice |
| fire, makefire, givefire | player, color | Moderators | Sets the target player(s) on fire, coloring the fire based on what you server |
| unfire, removefire, extinguish | player | Moderators | Puts out the flames on the target player(s) |
| smoke, givesmoke | player, color | Moderators | Makes smoke come from the target player(s) with the desired color |
| unsmoke | player | Moderators | Removes smoke from the target player(s) |
| sparkles | player, color | Moderators | Puts sparkles on the target player(s) with the desired color |
| unsparkles | player | Moderators | Removes sparkles from the target player(s) |
| animation, loadanim, animate | player, animationID | Moderators | Load the animation onto the target |
| blur, screenblur, blureffect | player, blur size | Moderators | Blur the target player's screen |
| bloom, screenbloom, bloomeffect | player, intensity, size, threshold | Moderators | Give the player's screen the bloom lighting effect |
| sunrays, screensunrays, sunrayseffect | player, intensity, spread | Moderators | Give the player's screen the sunrays lighting effect |
| colorcorrect, colorcorrection, correctioneffect, correction, cce | player, brightness, contrast, saturation, tint | Moderators | Give the player's screen the sunrays lighting effect |
| freaky | 0-600,0-600,0-600, optional player | Moderators | Does freaky stuff to lighting. Like a messed up ambient. |
| loadsky, skybox | front, back, left, right, up, down, celestialBodies? (default: true), starCount (default: 3000) | Admins | Change the skybox front with the provided image IDs |
| startergear, givestartergear | player, id | Moderators | Inserts the desired gear into the target player(s)'s starter gear |
| gear, givegear | player, id | Moderators | Gives the target player(s) a gear from the catalog based on the ID you supply |
| slippery, iceskate, icewalk, slide | player | Moderators | Makes the target player(s) slide when they walk |
| unslippery, uniceskate, unslide | player | Moderators | Get sum friction all up in yo step |
| oldbodyswap, oldbodysteal | player1, player2 | Moderators | [Old] Swaps player1's and player2's bodies and tools |
| bodyswap, bodysteal, bswap | player1, player2 | Moderators | Swaps player1's and player2's avatars, bodies and tools |
| explode, boom, boomboom | player, radius (default: 20 studs), blast pressure (default: 500,000), visible? (default: true) | Moderators | Explodes the target player(s) |
| trip | player, angle | Moderators | Rotates the target player(s) by 180 degrees or a custom angle |
| oddliest | player | Moderators | Turns you into the one and only Oddliest |
| sceleratis | player | Moderators | Turns you into me <3 |
| thermal, thermalvision, heatvision | player | Moderators | Looks like heat vision |
| unthermal, unthermalvision | player | Moderators | Removes the thermal effect from the target player's screen |
| ggrav, gamegrav, workspacegrav | number or fix | Admins | Sets Workspace.Gravity |
| createsoundpart, createspart | soundid, soundrange (default: 10) (max: 100), pitch (default: 1), noloop (default: false), volume (default: 1), clicktotoggle (default: false), share type (default: everyone) | Admins | Creates a sound part |
| pipe | player | Moderators | Drops a metal pipe on the target player(s). |
| sing | player, soundid | Moderators | Sings the song |

## HeadAdmins
| Commands | Args | Admin Level | Description |
| --- | --- | --- | --- |
| timeban, tempban, tban, temporaryban | player, number<s/m/h/d>, reason | HeadAdmins |  |
| directtimeban, directtimedban, directtempban, directtban, directtemporaryban | username(s), number<s/m/h/d>, reason | HeadAdmins |  |
| untimeban, untimedban, untban, untempban, untemporaryban | user | HeadAdmins | Removes the target user(s) from the timebans list |
| globalban, permban, permanentban, pban, gameban, gban | player/user, reason | HeadAdmins | Bans the target player(s) from the game permanently; if they join a different server they will be banned there too |
| unglobalban, unpermban, unpermanentban, unpban, ungameban, ungban | user | HeadAdmins | Unbans the target user(s) from the game; saves |
| tempadmin, tadmin | player | HeadAdmins | Makes the target player(s) a temporary admin; does not save |
| permadmin, padmin, admin | player/user | HeadAdmins | Makes the target player(s) an admin; saves |
| globalmessage, gm, globalannounce | message | HeadAdmins | Sends a global message to all servers |
| gtm, globaltimedmessage, globaltimemessage, globaltimem | time, message | HeadAdmins | Sends a global message to all servers and makes it stay on the screen for the amount of time (in seconds) you supply |
| fullclear, clearinstances, fullclr |  | HeadAdmins | Removes any instance created server-side by Adonis; May break things |
| backupmap, mapbackup, bmap |  | HeadAdmins | Changes the backup for the restore map command to the map's current state |
| explore, explorer |  | HeadAdmins |  |
| promptinvite, inviteprompt, forceinvite | player | HeadAdmins | Opens the friend invitation popup for the target player(s), same as them running !invite |
| forcerejoin | player | HeadAdmins |  |
| fullshutdown, globalshutdown | reason | HeadAdmins | Initiates a shutdown for every running game server |
| incognito | player, hideFromNonAdmins(default true), hideCharacter(default true) | HeadAdmins | Removes the target player from other clients' perspectives (persists until rejoin). Allows to set whether to hide only from nonadmins or from everyone. |
| awardbadge, badge, givebadge | player, badgeId | HeadAdmins | Awards the badge of the specified ID to the target player(s) |
| scriptbuilder, scriptb, sb | create/remove/edit/close/clear/append/run/stop/list, localscript/script, scriptName, data | HeadAdmins | [Deprecated] Script Builder; make a script, then edit it and chat it's code or use :sb append <codeHere> |
| s, ss, serverscript, sscript, script, makescript | code | HeadAdmins | Executes the given Lua code on the server |
| ls, localscript, lscript | code | HeadAdmins | Executes the given code on your client |
| cs, cscript, clientscript | player, code | HeadAdmins | Executes the given code on the client of the target player(s) |
| starterscript, clientstarterscript, starterclientscript, createstarterscript | name, code | HeadAdmins | Executes the given code on everyone's client upon respawn |
| starterscripts, clientstarterscripts, starterclientscripts |  | HeadAdmins | Show existing starterscripts |
| removestarterscript, removeclientstarterscripts, removestarterclientscripts, unstarterscript | name | HeadAdmins | Remove a starterscript |

## Moderators
| Commands | Args | Admin Level | Description |
| --- | --- | --- | --- |
| kick | player, optional reason | Moderators | Disconnects the target player from the server |
| esp | target (optional), brickcolor (optional) | Moderators | Allows you to see <target> (or all humanoids if no target is supplied) through walls |
| unesp |  | Moderators | Removes ESP |
| thru, pass, through | distance? (default: 5) | Moderators | Lets you pass through an object or a wall |
| timebanlist, timebanned, timebans |  | Moderators | Shows you the list of time banned users |
| notify, notification, notice | player, message | Moderators | Sends the player a notification |
| slowmode | seconds or "disable" | Moderators | Chat Slow Mode |
| countdown, timer, cd | time (in seconds) | Moderators | Countdown |
| countdownpm, timerpm, cdpm | player, time (in seconds) | Moderators | Countdown on a target player(s) screen. |
| hcountdown, hc | time | Moderators | Hint Countdown |
| stopcountdown, stopcd |  | Moderators | Stops all currently running countdowns |
| tm, timem, timedmessage, timemessage | time, message | Moderators | Make a message and makes it stay for the amount of time (in seconds) you supply |
| m, message | message | Moderators | Makes a message |
| mpm, messagepm | player, message | Moderators | Makes a private message on the target player(s) screen. |
| n, smallmessage, nmessage, nmsg, smsg, smessage | message | Moderators | Makes a small message |
| cn, customsmallmessage, cnmessage | title, message | Moderators |  |
| npm, smallmessagepm, nmessagepm, nmsgpm, npmmsg, smsgpm, spmmsg, smessagepm | player, message | Moderators | Makes a small private message on the target player(s) screen. |
| h, hint | message | Moderators | Makes a hint |
| th, timehint, thint | time, message | Moderators | Makes a hint and make it stay on the screen for the specified amount of time |
| warn, warning | player/user, reason | Moderators | Warns players |
| kickwarn, kwarn, kickwarning | player/user, reason | Moderators | Warns & kicks a player |
| removewarning, unwarn | player/user, warning reason | Moderators | Removes the specified warning from the target player |
| clearwarnings, clearwarns | player | Moderators | Clears any warnings on a player |
| warnings, showwarnings, warns, showwarns, warnlist | player | Moderators | Shows a list of warnings a player has |
| chatnotify, chatmsg | player, message | Moderators | Makes a message in the target player(s)'s chat window |
| ff, forcefield | player, visible? (default: true) | Moderators | Gives a force field to the target player(s) |
| unff, unforcefield | player | Moderators | Removes force fields on the target player(s) |
| punish | player | Moderators | Removes the target player(s)'s character |
| unpunish | player | Moderators | UnPunishes the target player(s) |
| freeze | player | Moderators | Freezes the target player(s) |
| thaw, unfreeze, unice | player | Moderators | UnFreezes the target players, thaws them out |
| afk | player | Moderators | FFs, Gods, Names, Freezes, and removes the target player's tools until they jump. |
| heal | player | Moderators | Heals the target player(s) (Regens their health) |
| god, immortal | player | Moderators | Makes the target player(s) immortal, makes their health so high that normal non-explosive weapons can't kill them |
| ungod, mortal, unfullgod, untotalgod | player | Moderators | Makes the target player(s) mortal again |
| fullgod, totalgod | player | Moderators |  |
| removehats, nohats, clearhats, rhats | player | Moderators | Removes any hats the target is currently wearing and from their HumanoidDescription. |
| removehat, rhat | player, accessory name | Moderators | Removes specific hat(s) the target is currently wearing |
| removelayeredclothings | player | Moderators | Remvoes layered clothings from their HumanoidDescription. |
| privatechat, dm, pchat | player, message (optional) | Moderators | Send a private message to a player |
| pm, privatemessage | player, message | Moderators | Send a private message to a player |
| uncolorcorrection, uncorrection, uncolorcorrectioneffect | player | Moderators | UnColorCorrection the target player's screen |
| unsunrays | player | Moderators | UnSunrays the target player's screen |
| unbloom, unscreenbloom | player | Moderators | UnBloom the target player's screen |
| unblur, unscreenblur | player | Moderators | UnBlur the target player's screen |
| unlightingeffect, unscreeneffect | player | Moderators | Remove admin made lighting effects from the target player's screen |
| handto | player | Moderators | Hands an item to a player |
| showtools, viewtools, seebackpack, viewbackpack, showbackpack, displaybackpack, displaytools, listtools | player, autoupdate? (default: false) | Moderators | Shows you a list of items currently in the target player(s) backpack |
| players, playerlist, listplayers | autoupdate? (default: true) | Moderators | Shows you all players currently in-game, including nil ones |
| waypoint, wp, checkpoint | name | Moderators | Makes a new waypoint/sets an exiting one to your current position with the name <name> that you can teleport to using :tp me waypoint-<name> |
| delwaypoint, delwp, delcheckpoint, deletewaypoint, deletewp, deletecheckpoint | name | Moderators | Deletes the waypoint named <name> if it exist |
| waypoints |  | Moderators | Shows available waypoints, mouse over their names to view their coordinates |
| cameras, cams |  | Moderators | Shows a list of admin cameras |
| makecam, makecamera, camera, newcamera, newcam | name | Moderators | Makes a camera named whatever you pick |
| removecam, delcam, removecamera, deletecamera | camera | Moderators | Deletes the camera if it exists |
| viewcam, viewc, camview, watchcam, cam | camera | Moderators | Makes you view the target camera |
| fview, forceview, forceviewplayer, fv | player1, player2 | Moderators | Forces one player to view another |
| view, watch, nsa, viewplayer | player, persist (default: true) | Moderators | Makes you view the target player |
| viewport, cctv | player | Moderators | Makes a viewport of the target player<s> |
| resetview, rv, fixview, fixcam, unwatch, unview | optional player | Moderators | Resets your view |
| guiview, showguis, viewguis | player | Moderators | Shows you the player's character and any guis in their PlayerGui folder [May take a minute] |
| unguiview, unshowguis, unviewguis |  | Moderators | Removes the viewed player's GUIs |
| clean |  | Moderators | Cleans some useless junk out of workspace |
| repeat, loop | amount, interval, command | Moderators | Repeats <command> for <amount> of times every <interval> seconds; Amount cannot exceed 50 |
| abort, stoploop, unloop, unrepeat | username, command | Moderators | Aborts a looped command. Must supply name of player who started the loop or \ |
| abortall, stoploops | username (optional) | Moderators | Aborts all existing command loops |
| cmdbox, commandbox |  | Moderators | Command Box |
| getping | player | Moderators | Shows the target player's ping |
| :tasks, :tasklist | player | Moderators | Displays running tasks |
| toserver, joinserver, jserver, jplace | player, JobId | Moderators | Send player(s) to a specific server using the server's JobId |
| admins, adminlist, headadmins, owners, moderators, ranks |  | Moderators | Shows you the list of admins, also shows admins that are currently in the server |
| banlist, banned, bans, banland |  | Moderators | Shows you the normal ban list |
| vote, makevote, startvote, question, survey | player, answer1,answer2,etc (NO SPACES), question | Moderators | Lets you ask players a question with a list of answers and get the results |
| orderedvote, ovote | player, answer1,answer2,etc (NO SPACES), question | Moderators |  |
| tools, toollist, toolcenter, savedtools, addedtools, toolpanel, toolspanel |  | Moderators |  |
| piano | player | Moderators | Gives you a playable keyboard piano. Credit to NickPatella. |
| insertlist, inserts, inslist, modellist, models |  | Moderators | Shows you the script's available insert list |
| insclear, clearinserted, clrins, insclr |  | Moderators | Removes inserted objects |
| clear, cleargame, clr |  | Moderators | Remove admin objects |
| serverinstances |  | Moderators | Shows all instances created server-side by Adonis |
| clientinstances | player | Moderators | Shows all instances created client-side by Adonis |
| clearadonisguis, clearguis, clearmessages, clearhints, clrguis | player, delete all? (default: false) | Moderators |  |
| cleareffects | player | Moderators | Removes all screen UI effects such as Spooky, Clown, ScreenImage, ScreenVideo, etc. |
| resetlighting, undisco, unflash, fixlighting, resetatmosphere, fixatmosphere |  | Moderators | Reset lighting back to the setting it had on server start |
| fixplayerlighting, rplighting, clearlighting, serverlighting | player | Moderators | Sets the player's lighting to match the server's |
| resetstats, rs | player | Moderators | Sets target player(s)'s leader stats to 0 (N/A if it's a string) |
| sell, promptpurchase | player, id | Moderators | Prompts the player(s) to buy the product belonging to the ID you supply |
| capes, capelist |  | Moderators | Shows you the list of capes for the cape command |
| cape, givecape | player, name/color, material, reflectance, id | Moderators |  |
| uncape, removecape | player | Moderators | Removes the target player(s)'s cape |
| noclip | player | Moderators | NoClips the target player(s); allowing them to walk through walls |
| clip, unnoclip | player | Moderators | Un-NoClips the target player(s) |
| jail, imprison | player, Duration: Optional, BrickColor: Optional | Moderators | Jails the target player(s), removing their tools until they are un-jailed; Put an optional time function to set when they get released from jail; Specify a BrickColor to change the color of the jail bars |
| unjail, free, release | player | Moderators | UnJails the target player(s) and returns any tools that were taken from them while jailed |
| bchat, dchat, bubblechat, dialogchat | player, color(red/green/blue/white/off) | Moderators | Gives the target player(s) a little chat gui, when used will let them chat using dialog bubbles |
| track, trace, find, locate | player, persistent? (default: false) | Moderators | Shows you where the target player(s) is/are |
| untrack, untrace, unfind, unlocate, notrack | player | Moderators | Stops tracking the target player(s) |
| phase | player | Moderators | Makes the player(s) character completely local |
| unphase | player | Moderators | UnPhases the target player(s) |
| startertools, starttools | player | Moderators | Gives the target player(s) tools that are in the game's StarterPack |
| loadavatar, loadchar, loadcharacter, clone, cloneplayer, duplicate | player, copies (max: 50 \| default: 1), appearence (optional), avatar type(R6/R15) (optional) | Moderators | Copies the target character in front of you with the specified amount of copies. |
| copychar, copycharacter, copyplayercharacter | player, target | Moderators | Changes specific players' character to the target's character. (i.g. To copy Player1's character, do ':copychar me Player1') |
| clickteleport, teleporttoclick, ct, clicktp, forceteleport, ctp, ctt | player | Moderators | Gives you a tool that lets you click where you want the target player to stand, hold r to rotate them |
| clickwalk, cw, ctw, forcewalk, walktool, walktoclick, clickcontrol, forcewalk | player | Moderators | Gives you a tool that lets you click where you want the target player to walk, hold r to rotate them |
| control, takeover | player | Moderators | Lets you take control of the target player |
| refresh, ref | player | Moderators | Refreshes the target player(s)'s character |
| kill | player | Moderators | Kills the target player(s) |
| respawn, re, reset, res | player | Moderators | Respawns the target player(s) |
| r6, classicrig | player | Moderators | Converts players' character to R6 |
| r15, rthro | player | Moderators | Converts players' character to R15 |
| stun | player | Moderators | Stuns the target player(s) |
| unstun | player | Moderators | UnStuns the target player(s) |
| jump | player | Moderators | Forces the target player(s) to jump |
| sit, seat | player | Moderators | Forces the target player(s) to sit |
| transparency, trans | player, % value (0-1) | Moderators | Set the transparency of the target's character |
| transparentpart | player, part names, % value (0-1) | Moderators | Set the transparency of the target's character's parts, including accessories; supports a comma-separated list of part names |
| invisible, invis | player | Moderators | Makes the target player(s) invisible |
| visible, vis, uninvisible | player | Moderators | Makes the target player(s) visible |
| color, playercolor, bodycolor | player, brickcolor or RGB | Moderators | Recolors the target character(s) with the given color, or random if none is given |
| lock, lockplr, lockplayer | player | Moderators | Locks the target player(s), preventing the use of btools on the character |
| unlock, unlockplr, unlockplayer | player | Moderators | UnLocks the the target player(s), makes it so you can use btools on them |
| light | player, color | Moderators | Makes a PointLight on the target player(s) with the color specified |
| unlight | player | Moderators | UnLights the target player(s) |
| ambient | num,num,num, optional player | Moderators | Change Ambient |
| oambient, outdoorambient | num,num,num, optional player | Moderators | Change OutdoorAmbient |
| nofog, fogoff, unfog | optional player | Moderators | Fog Off |
| shadows | on/off, optional player | Moderators | Determines if shadows are on or off |
| brightness | number, optional player | Moderators | Change Brightness |
| time, timeofday | time, optional player | Moderators | Change Time |
| fogcolor | num,num,num, optional player | Moderators | Fog Color |
| fog | start, end, optional player | Moderators | Fog Start/End |
| startergive | player, toolname | Moderators | Places the desired tool into the target player(s)'s StarterPack |
| starterremove | player, toolname | Moderators | Removes the desired tool from the target player(s)'s StarterPack |
| give, tool | player, tool | Moderators | Gives the target player(s) the desired tool(s) |
| steal, stealtools | player1, player2 | Moderators | Steals player1's tools and gives them to player2 |
| copytools | player1, player2 | Moderators | Copies player1's tools and gives them to player2 |
| clearscreenguis, clrscreenguis, removeguis, noguis | player | Moderators | Removes all of the target player(s)'s on-screen GUIs except Adonis GUIs |
| removetools, notools, rtools, deltools | player | Moderators | Remove the target player(s)'s tools |
| removetool, rtool, deltool | player, tool name | Moderators | Remove a specified tool from the target player(s)'s backpack |
| rank, getrank, grouprank | player, group name | Moderators | Shows you what rank the target player(s) are in the specified group |
| damage, hurt | player, number | Moderators | Removes <number> HP from the target player(s) |
| health, sethealth | player, number | Moderators | Set the target player(s)'s health and max health to <number> |
| jpower, jpow, jumppower | player, number | Moderators | Set the target player(s)'s jump power to <number> |
| jheight, jumpheight | player, number | Moderators | Set the target player(s)'s jump height to <number> |
| speed, setspeed, walkspeed, ws | player, number | Moderators | Set the target player(s)'s WalkSpeed to <number> |
| team, setteam, changeteam | player, team | Moderators | Set the target player(s)'s team to <team> |
| rteams, rteam, randomizeteams, randomteams, randomteam | players, teams | Moderators | Randomize teams; :rteams or :rteams all or :rteams nonadmins team1,team2,etc |
| unteam, removefromteam, neutral | player | Moderators | Takes the target player(s) off of a team and sets them to 'Neutral' |
| teams, teamlist, manageteams |  | Moderators | Opens the teams manager GUI |
| fov, fieldofview, setfov | player, number | Moderators | Set the target player(s)'s field of view to <number> (min 1, max 120) |
| place | player, placeID/serverName | Moderators | Teleport the target player(s) to the place belonging to <placeID> or a reserved server |
| makeserver, reserveserver, privateserver | serverName, (optional) placeId | Moderators | Makes a private server that you can teleport yourself and friends to using :place player(s) serverName; Will overwrite servers with the same name; Caps specific |
| delserver, deleteserver, removeserver, rmserver | serverName | Moderators | Deletes a private server from the list. |
| privateservers, createdservers |  | Moderators | Shows you a list of private servers that were created with :makeserver |
| plazaconnect, grplaza, grouprecruitingplaza, groupplaza | player | Moderators | Teleports the target player(s) to Plaza Connect to look for potential group members |
| tp, teleport, transport | player1, player2 | Moderators | Teleport player1(s) to player2, a waypoint, or specific coords, use :tp player1 waypoint-WAYPOINTNAME to use waypoints, x,y,z for coords |
| bring | player | Moderators | Teleports the target player(s) to your position |
| to, goto | destination  ('<player>'/'waypoint-<name>'/'<x>,<y>,<z>') | Moderators | Teleports you to the target player, waypoint or coordinates |
| back, return | player | Moderators | Returns the player to their original position |
| massbring, bringrows, bringlines | player(s), lines (default: 3) | Moderators | Teleports the target player(s) to you; positioning them evenly in specified lines |
| change, leaderstat, stat, changestat | player, stat, value | Moderators | Change the target player(s)'s leaderstat <stat> value to <value> |
| removestats, delstat | name | Moderators | Removes a leaderstat entirely |
| newstat, createstat, cstat | statname, type (string/number [default: number]) | Moderators | Creates a new stat on the leaderboard |
| add, addtostat, addstat | player, stat, value | Moderators | Add <value> to <stat> |
| subtract, minusfromstat, minusstat, subtractstat | player, stat, value | Moderators | Subtract <value> from <stat> |
| customtshirt | player, ID | Moderators | Give the target player(s) the t-shirt that belongs to <ID>. Supports images and catalog items. |
| customshirt | player, ID | Moderators | Give the target player(s) the shirt that belongs to <ID>. Supports images and catalog items. |
| custompants | player, id | Moderators | Give the target player(s) the pants that belongs to <ID>. Supports images and catalog items. |
| customface | player, id | Moderators | Give the target player(s) the face that belongs to <ID>. Supports images and catalog items. |
| saveoutfit, savefit | player | Moderators | Saves your current character's appearance when respawning |
| removesavedoutfit, removeoutfit, removefit, defaultavatar | player | Moderators | Removes any currently saved outfits and reverts your character to its original look |
| avataritem, giveavtaritem, catalogitem, accessory, hat, tshirt, givetshirt, shirt, giveshirt, pants, givepants, face, anim, torso, larm, leftarm, rarm, rightarm, lleg, leftleg, rleg, rightleg, head, walkanimation, walkanim, runanimation, runanim, jumpanimation, jumpanim, fallanimation, fallanim | player, ID | Moderators | Give the target player(s) the avatar/catalog item matching <ID> and adds it to their HumanoidDescription. |
| removetshirt, untshirt, notshirt | player | Moderators | Remove any t-shirt(s) worn by the target player(s) |
| removeshirt, unshirt, noshirt | player | Moderators | Remove any shirt(s) worn by the target player(s) |
| removepants | player | Moderators | Remove any pants(s) worn by the target player(s) |
| taudio, localsound, localaudio, localsong, localmusic, lsound, laudio, lsong, lmusic | player, audioId, noLoop, pitch, volume | Moderators | Plays an audio on the specified player's client |
| untaudio, unlocalsound, unlocalaudio, unlsound, unlaudio | player | Moderators | Stops audio playing on the specified player's client |
| charaudio, charactermusic, charmusic | player, audioId, volume, loop(true/false), pitch | Moderators | Plays an audio from the target player's character |
| uncharaudio, uncharactermusic, uncharmusic | player | Moderators |  |
| pause, pausemusic, psound, pausesound |  | Moderators | Pauses the current playing song |
| resume, resumemusic, rsound, resumesound |  | Moderators | Resumes the current playing song |
| pitch | number | Moderators | Change the pitch of the currently playing song |
| volume, vol | number | Moderators | Change the volume of the currently playing song |
| shuffle | songID1,songID2,songID3,etc | Moderators | Play a list of songs automatically; Stop with :shuffle off |
| music, song, playsong, sound | id, noloop(true/false), pitch, volume | Moderators | Start playing a song |
| stopmusic, musicoff, unmusic |  | Moderators | Stop the currently playing song |
| musiclist, listmusic, songs |  | Moderators | Shows you the script's available music list |
| fly, flight, flynoclip | player, speed, noclip? (default: true) | Moderators | Lets the target player(s) fly |
| flyspeed, flightspeed | player, speed | Moderators | Change the target player(s) flight speed |
| unfly, ground | player | Moderators | Removes the target player(s)'s ability to fly |
| fling | player | Moderators | Fling the target player(s) |
| sfling, tothemoon, superfling | player, optional strength | Moderators | Super fling the target player(s) |
| displayname, dname | player, name/hide | Moderators | Name the target player(s) <name> or say hide to hide their character name |
| undisplayname, undname | player | Moderators | Put the target player(s)'s back to normal |
| name, rename | player, name/hide | Moderators | Name the target player(s) <name> or say hide to hide their character name |
| unname, fixname | player | Moderators | Put the target player(s)'s back to normal |
| package, givepackage, setpackage, bundle | player, id | Moderators | Gives the target player(s) the desired package (ID MUST BE A NUMBER) |
| outfit | player, outfitid | Moderators | Changes the target player(s)'s character appearence to a specified OutfitID. You can get OutfitID(s) by using Roblox Avatar API. |
| char, character, appearance | player, username | Moderators | Changes the target player(s)'s character appearence to <ID/Name>. |
| unchar, uncharacter, fixappearance | player | Moderators | Put the target player(s)'s character appearence back to normal |
| loopheal | player | Moderators | Continuously heals the target player(s) |
| unloopheal | player | Moderators |  |
| serverlog, serverlogs, serveroutput | autoupdate? (default: false) | Moderators | View server log |
| locallog, clientlog, locallogs, localoutput, clientlogs | player, autoupdate? (default: false) | Moderators | View local log |
| errorlogs, debuglogs, errorlog, errors, debuglog, scripterrors, adminerrors | autoupdate? (default: false) | Moderators | View script error log |
| exploitlogs, exploitlog | autoupdate? (default: false) | Moderators | View the exploit logs for the server OR a specific player |
| joinlogs, joins, joinhistory | autoupdate? (default: false) | Moderators | Displays the current join logs for the server |
| leavelogs, leaves, leavehistory | autoupdate? (default: false) | Moderators | Displays the current leave logs for the server |
| chatlogs, chats, chathistory | autoupdate? (default: false) | Moderators | Displays the current chat logs for the server |
| remotelogs, remotelog, rlogs, remotefires, remoterequests | autoupdate? (default: false) | Moderators | View the remote logs for the server |
| scriptlogs, scriptlog, adminlogs, adminlog, scriptlogs | autoupdate? (default: false) | Moderators | View the admin logs for the server |
| logs, log, commandlogs | autoupdate? (default: false) | Moderators | View the command logs for the server |
| oldlogs, oldserverlogs, oldcommandlogs | autoupdate? (default: false) | Moderators | View the command logs for previous servers ordered by time |
| showlogs, showcommandlogs | player, autoupdate? (default: false) | Moderators | Shows the target player(s) the command logs. |
| mute, silence | player, duration (optional) | Moderators | Makes it so the target player(s) can't talk |
| unmute, unsilence | player | Moderators | Makes it so the target player(s) can talk again. No effect if on Trello mute list. |
| mutelist, mutes, muted |  | Moderators | Shows a list of currently muted players |
| freecam | player | Moderators | Makes it so the target player(s)'s cam can move around freely (Press Shift+P, F, or DPadLeft to toggle freecam) |
| unfreecam | player | Moderators | UnFreecam |
| togglefreecam | player | Moderators | Toggles Freecam |
| bot, trainingbot | player, num (max: 50), walk, attack, friendly, health, speed, damage | Moderators | AI bots made for training; ':bot scel 5 true true' |
| tell, tts, texttospeech | player, message | Moderators | [Experimental] Says aloud the supplied text |
| groupinvite, invitegroup, groupprompt, communityinvite | player, groupId | Moderators | Prompts player(s) to join the specified community/group |
| reverb, ambientreverb | reverbType, optional player | Moderators | Lets you change the reverb type with an optional player argument (CASE SENSITTIVE) |
| resetbuttonenabled, resetenabled, canreset, allowreset | player, can reset? (true/false) | Moderators | Sets whether the target player(s) can reset their character |
| perfstats, performancestats, serverstats | autoupdate? (default: true) | Moderators | Shows you technical server performance statistics |
| select, selectplayers, count, countplayers, getplayers | player(s), autoupdate? (default: false) | Moderators |  |
| healthlist, healthlogs, healths, hlist, hlogs | autoupdate? (default: true) | Moderators | Shows a list of all players' current and max healths. |
| incognitolist, incognitoplayers | autoupdate? (default: true) | Moderators | Displays a list of incognito players in the server |
| starterhealth, starthealth, persisthealth | player, health | Moderators | Sets the target player(s)'s starting health |
| unstarterhealth, unstarthealth, resetstarterhealth, unpersisthealth | player | Moderators | Removes the target player(s)'s custom starting health |
| starterspeed, startspeed, persistspeed | player, speed | Moderators | Sets the target player(s)'s starting speed |
| unstarterspeed, unstartspeed, resetstarterspeed, unpersistspeed | player | Moderators | Removes the target player(s)'s custom starting speed |
| join, follow, followplayer | username | Moderators | Makes you follow the player you gave the username of to the server they are in |

## Players
| Commands | Args | Admin Level | Description |
| --- | --- | --- | --- |
| cmds, commands, cmdlist |  | Players | Lists all available commands |
| cmdinfo, commandinfo, cmddetails, commanddetails | command | Players | Shows you information about a specific command |
| notepad, stickynote | text (optional) | Players | Opens a textbox window for you to type into |
| paint, canvas, draw |  | Players | Opens a canvas window for you to draw on |
| example |  | Players | Shows you the command prefix using the :cmds command |
| notifyme | time (in seconds) or inf, message | Players | Sends yourself a notification |
| notifications, comms, nc, commspanel |  | Players | Opens the communications panel, showing you all the Adonis messages you have recieved in a timeline |
| rand, random, randnum, dice | num m, num n | Players | Generates a number using Lua's math.random |
| brickcolors, colors, colorlist |  | Players | Shows you a list of Roblox BrickColors for reference |
| materials, materiallist, mats |  | Players | Shows you a list of Roblox materials for reference |
| client, clientsettings, playersettings |  | Players | Opens the client settings panel |
| donate, change, changecape, donorperks |  | Players | Opens the donation panel |
| getscript, getadonis |  | Players | Prompts you to take a copy of the script |
| cstats, clientperformance, clientperformanceststs, clientstats, ping, latency, fps, framespersecond |  | Players | Shows you your client performance stats |
| serverspeed, serverping, serverfps, serverlag, tps |  | Players | Shows you the FPS (speed) of the server |
| donors, donorlist, donatorlist, donators | autoupdate? (default: true) | Players | Shows a list of Adonis donators who are currently in the server |
| help, requesthelp, gethelp, lifealert, sos | reason | Players | Calls admins for help |
| rejoin |  | Players | Makes you rejoin the server |
| credit, credits |  | Players | Shows you Adonis development credits |
| changelog, changes, updates, version |  | Players | Shows you the script's changelog |
| quote, inspiration, randomquote |  | Players | Shows you a random quote |
| usage, usermanual |  | Players | Shows you how to use some syntax related things |
| :userpanel |  | Players | Backup command for opening the userpanel window |
| theme, usertheme | theme name (leave blank to reset to default) | Players | Changes the Adonis client UI theme |
| info, about, userpanel, script, scriptinfo |  | Players | Shows info about the admin system (Adonis) |
| aliases, addalias, removealias, newalias |  | Players | Opens the alias manager |
| keybinds, binds, bind, keybind, clearbinds, removebind |  | Players | Opens the keybind manager |
| invite, invitefriends |  | Players | Invite your friends into the game |
| onlinefriends, friendsonline, friends |  | Players | Shows a list of your friends who are currently online |
| blockedusers, blockedplayers, blocklist |  | Players | Shows a list of people you've blocked on Roblox |
| getpremium, purchasepremium, robloxpremium |  | Players | Prompts you to purchase Roblox Premium |
| inspectavatar, avatarinspect, viewavatar, examineavatar | player | Players | Opens the Roblox avatar inspect menu for the specified player |
| devconsole, developerconsole, opendevconsole |  | Players | Opens the Roblox developer console |
| pnum, numplayers, playercount |  | Players | Tells you how many players are in the server |
| countdown, timer, cd | time (in seconds) | Players | Makes a countdown on your screen |
| stopwatch |  | Players | Makes a stopwatch on your screen |
| profile, inspect, playerinfo, whois, viewprofile | player | Players | Shows comphrehensive information about a player |
| serverinfo, server, serverdetails, gameinfo, gamedetails |  | Players | Shows you details about the current server |
| ap, audioplayer, mp, musicplayer | soundId? | Players | Opens the audio player |
| buyitem, buyasset | id | Players | Prompts yourself to buy the asset belonging to the ID supplied |
| coordinates, coords, position |  | Players | Shows your current position in the game world |
| wait | time | Players | Waits for the desired amount of time in seconds. Only works with batch commands |
