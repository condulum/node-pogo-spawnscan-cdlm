// this module solves captcha, either manually, or 2captcha.

// check if electron exists

const req = require('request-promise');
const url = require('url');

let electron;

try {
  let {app, BrowserWindow} = require('electron');
  let logic = require('./electron/logic.js');
  electron = true;
} catch (e) {
  electron = false;
}

let SOLVE_URL = {
  protocol: "http",
  host: "2captcha.com",
  pathname: "/in.php",
};

let FETCH_URL = {
  protocol: "http",
  host: "2captcha.com",
  pathname: "/res.php",
};

export default class Solver {

  constructor(obj) {

    this.two_key = obj.two_key; 
    this.site_key = obj.site_key || "6LeeTScTAAAAADqvhqVMhPpr_vB9D364Ia-1dSgK";

    // pass undefined if no 2 cap

    if (obj.two_cap) {
      if (obj.two_key) {
        this.solve = this.solve_two_cap;
      } else {
        this.solve = this.solve_manual;
      }
    } else if (obj.manual){
      this.solve = this.solve_manual;
    } else {
      this.solve = () => new Promise.reject(new Error('You cannot solve captha without 2captcha / manual solving (electron)'));
    }
  }

  solve_two_cap(cap_url=null) {
    return new Promise((resolve, reject) => {
      if (cap_url) {

        let options = {
          method: 'POST',
          uri: url.format(SOLVE_URL),
          form: {
            key: this.two_key,
            method: "userrecaptcha",
            googlekey: this.site_key,
            pageurl: cap_url,
            json: 1
          }
        };

        req(options)
          .then(res => {
            res = JSON.parse(res);

            const poll = setInterval(() => {
              this.fetch_two_cap(res.CAPTCHA_ID)

                .then(token => {
                  if (token) {
                    resolve(token);
                    clearInterval(poll);
                  }
                }, err => {
                  reject(err);
                })
              
            }, 5000);

          }, err => {
            reject(err);
          })

      } else {
        reject(new Error("No captcha url provided."));
      }
    });

  }

  fetch_two_cap(captcha_id=null) {
    return new Promise((resolve, reject) => {
      if (captcha_id) {
        let options = {
          method: "POST",
          uri: url.format(FETCH_URL),
          query: {
            key: this.two_key,
            action: "get",
            id:captcha_id,
            json:1
          }
        };
        req(options)
          .then(res => {
            resolve(res.request);
          }, err => {
            reject(err);
          });
      } else {
        reject(new Error("No Captcha_ID provided"));
      }
    });

  }

  solve_manual(cap_url) {
    if (electron) {
      //logic.solve(cap_url, this.site_key);
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