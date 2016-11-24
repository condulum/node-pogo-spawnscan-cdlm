# TODO

1. dude fix README.
2. WRITE PORTABLE CODE. --- PLUGINS, PLUG AND PLAY
3. Complete `calibrate_time.js`, to calibrate scanned spawn's time, assuming user has turned on predict_time config.
4. Provide script that checks all the accounts in accounts.yaml for captchas.
5. Implement Captcha check 
5.1 check DONE for more details
6. Implement Hotswap accounts for capped accounts
6.1 check DONE for more details
7. Implement "REPL" for pasting token when solved captcha. 
7.1 Check ROADPLAN 3
7.1 Found solution already: `require("repl")`
7.2 Flags to disable REPL and run Headless 
8. REPL option to toggle 2captcha solving / manual solving, (also defaults on hotswap accounts)
9. Turn this project into modules
9.1 Use the same codebase and implement into `node-pogo-scanner-cdlm`
9.2 Shut this project down, or turn this project into a submodule.

# IDEAS

1. Use NeDB for Worker database to preserve last_state?
2. Maybe implement timestamp check on computer? And check if timestamp is within X minute? if yes then load last_state?

# ROADPLAN 

### (Includes roadplan for node-pogo-scanner-cdlm, node-pogo-database-cdlm, node-pogo-contrib-cdlm and node-pogo-adapter-cdlm)

0. Finish up database, which is the mass contributed pokemon go database project.
1. Finish up contrib, which is the gateway for user submitted data.
2. (Probably port part of this to Go? I don't know...)
3. Implement REPL, for full control of scanner.
4. Implement Proxy support, individually for each account / globally for every eccount.
5. Somehow Implement Tor Support. 
6. node-pogo-database-cdlm, regional database, with regional moderator.
7. Create adapters, for 
7.1 different scanners pumping data to database/websites/apps/maps 
7.2 pumping data to social networks such as Twitter, Telegram
8. If app runs headless, create something that lets remote computer control this controller.

# DONE

1. Provide script that lets user turn ptc-acc-gen generated csv into yaml. (Also separate acc from config.yaml -> accounts.yaml)
1.1 Note: run csv2yaml.js first.

2. Support for both Pokemon Trainer Club accounts AND Google accounts. 
2.1 Note: takes type in yaml.

3. Implement Captcha check
3.1Note: Rudimentary captcha check, will implement electron popup solve / 2captcha solving, or append to "capped.csv"

4. Research for if Electron could be used to let the user solve the captcha and capture the token
4.1 Note: researched completed. Found PokemonGo-Map PR 1567, might contact 1567 author.