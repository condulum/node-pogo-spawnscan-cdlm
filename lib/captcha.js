// this module solves captcha, either manually, or 2captcha.

// check if electron exists

const req = require('then-request');
const url = require('url');

let electron;

try {
  let {app, BrowserWindow} = require('electron');
  let logic = require('./electron/logic.js');
  electron = true;
} catch (e) {
  electron = false;
}


let SOLVE_URL = "http://2captcha.com/in.php";
let FETCH_URL = "http://2captcha.com/res.php";

class Solver {

  constructor(obj) {
    
    this.polling = obj.polling;
    this.two_key = obj.two_key; 
    this.site_key = obj.site_key || "6LeeTScTAAAAADqvhqVMhPpr_vB9D364Ia-1dSgK";

    // pass undefined if no 2 cap

    if (obj.two_cap) {
      if (obj.two_key) {
        this.solve = this.solve_two_cap;
      } else {
        // no key provided, fallback to solve_manual.
      }
    } else {
      this.solve = this.solve_manual;
    }
  }

  solve_two_cap(cap_url, callback) {
    req('POST') //then set captcha_id
    if (this.polling) {
      const poll = setInterval(() => {
        fetch_two_cap()
        if (token) {
          callback(null, token)
          clearInterval(poll)
        }
      }, 5000)
    }
  }

  fetch_two_cap(captcha_id, callback) {
    req('POST')
  }

  solve_manual(cap_url) {
    if (electron) {
      logic.solve(this.site_key, this.url)
    }
  }

}
/*
s = new Solver(obj)

where obj = {
  two_cap: true,
  polling: true,
  site_key: null,
  two_key: "2captcha_key"
}

s.solve(cap_url)
fetch_two_cap manually fetches two captcha solved token
or, if polling is on, callback will contain token.
*/