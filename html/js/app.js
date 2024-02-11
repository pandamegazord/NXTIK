
import {authSubscribe, initJuno, signIn, signOut} from "https://cdn.jsdelivr.net/npm/@junobuild/core@latest/+esm";
import {getDoc, setDoc, listDocs, deleteDoc} from "https://cdn.jsdelivr.net/npm/@junobuild/core@latest/+esm";
import {nanoid} from "https://cdn.jsdelivr.net/npm/nanoid@latest/+esm";

class App {

    // --- Core UI Utils ----//
    static el(id) {
        return document.getElementById(id);
    }

    static all(q) {
        return document.querySelectorAll(q);
    }

    static hide(id) {
        App.el(id).classList.add('hidden');
    }

    static spin(id) {
        let element = App.el(id);
        let height = 20, width = 20;
        if (element && element.offsetHeight && .3*element.offsetHeight < height) {
            height = .3*element.offsetHeight
            width = height;
        }
        App.el(id).innerHTML = `<span class="spinner" style="height:${height}px;width:${width}px"></span>`;
    }

    static show(id) {
        App.el(id).classList.remove('hidden');
    }

    static bind() {
        let els = App.all("[data-bind]");
        els.forEach(async (e) => {
            if (e instanceof HTMLFormElement) {
                e.addEventListener("submit", async (evt)=> {
                    evt.preventDefault();
                    let collection = e.id;
                    let bind = e.dataset["bind"];
                    await App[bind](collection);
                });
            }
        });    
    }

    static async swap(id, url, cb) {
        App.spin(id);
        // TODO - fix this hack to eval incoming view script
        let resp =  await (await fetch(url)).text();
        let html = resp;
        if (resp.indexOf("<script") !== -1) html = resp.substring(0, resp.indexOf('<script'));
        App.el(id).innerHTML = html;
    
        if (resp && resp.indexOf("<script") > 0) {
          let part = resp.substring(resp.indexOf("<script"));
          let script = part
            .substring(part.indexOf(">") + 1, part.lastIndexOf("<"))
            .trim();
          if (script) await eval(script);
        }
        if (cb) await cb();
        App.bind();
    }

    static serialize(e) {
        let data = null;
        e = App.el(e);
        if (e && e.elements) {
          data = {};
          Array.from(e.elements).forEach((i) => {
            if (i && (i.name || i.id) &&
              (i instanceof HTMLInputElement ||
              i instanceof HTMLSelectElement ||
              i instanceof HTMLTextAreaElement))
            data[i.name || i.id] = i.value;
          });
        }
        return data;
    }


    //-------------Juno Wrappers-----------//

    static async set(collection, data, key) {
        if (data) {
            let updated_at = null;
            if (!key) key = data.key || nanoid();
            if (data.updated_at) updated_at = data.updated_at;
            delete data.key;
            delete data.updated_at;
            let doc = {
                collection,
                doc: {
                    key,
                    data,
                    // needed to preserve update
                    ...((updated_at) && {updated_at})
                }
            }
            await setDoc(doc);
            console.log("set done", doc);
        }
        return key;
    }

    static async get(collection, key) {
        let out = await getDoc({
            collection,
            key,
        });
        if (out && out.data) {
            out.data.key = out.key;
            out.data.updated_at = out.updated_at;
        }
        return out && out.data || null;
    }

    static async list(collection, filter) {
        console.log('listing:'+collection+' with filter:'+filter)
        let docs = await listDocs({
            collection,
            filter: {
                order: {
                    desc: true,
                    field: "updated_at"
                },
                matcher:{description:filter}
            }
        })
        return docs && docs.items || [];
    } 


    //------ APP FUNCTIONS -----///
    static async init() {
        await initJuno({satelliteId: "zltb5-yiaaa-aaaal-adqeq-cai"});
        authSubscribe(async (user) => {
            await App.welcome(user)
        });
        if (window.user) App.swap('main', 'welcome.html')
        else App.swap('main', 'home.html');
    }

    static async login() {
        await signIn();
    }

    static async logout() {
        await signOut();
        window.location = "/"
    }

    static async welcome(user) {
        App.spin('main');
        if (user) window.user = user;
        if (window.user) {
            if (!window.user.contests) window.user.contests = await App.myContests();
            let wallet = await App.get('wallet', window.user.key);
            if (!wallet) {
                await App.set('wallet', {balance: 1000}, window.user.key);
                wallet = {balance: 1000};
                alert("Welcome, we've given you 1000 points to start. Good luck!");
            }
            window.user.wallet = wallet;

            await App.swap('main', 'welcome.html');
            App.el('balance').innerHTML = `Points: ${+wallet.balance}`
            if (["qoku4-5jvtt-7yazg-ltpwm-jyy7q-zkmrp-t5nne-v6nlx-ucyaa-fbvqd-iqe", 
                "4i26p-s47tr-tq572-ilulj-rcs4g-ag2mz-sjmam-exjir-767oz-qx6ai-lae"].includes(window.user?.key) ) {
                window.user.admin = true;
                App.show('admin');
            }
            else App.hide('admin');

            await App.loadContests();
        }
    }

    static async loadContests(filter) {
        App.spin('contest-body');
        let contests = await App.list('contest', filter);
        let rows = ''
        contests.forEach(obj => {
            let contest = obj.data; 
            if (contest.status === 'active') {
                let key = obj.key;
                let onup = '';
                let ondown = '';
                if (Object.keys(window.user.contests).includes(key)) {
                    if (window.user.contests[key] === 'up') onup = 'onup';
                    else if (window.user.contests[key] === 'down') ondown = 'ondown';
                }
                rows+=`<tr>
                    <td>${contest.buyin} Points</td>
                    <td>
                        <img class="contest-icon" src="/img/${contest.market.substring(0,3)}.png"><br/>
                        ${contest.market}
                    </td>
                    <td>
                        <span>${contest.duration}</span><br/>
                        <span>${new Date(contest.start).toLocaleDateString('en-US')} - ${new Date(contest.end).toLocaleDateString('en-US')}</span>
                    </td>
                    <td>${parseInt(contest.bets||0) * parseInt(contest.buyin||0)}</td>
                    <td>
                        <a href="#" class="pure-button up ${onup}" onclick="app.predict('${key}', 'up')">Up</a>
                        <a href="#" class="pure-button down ${ondown}" onclick="app.predict('${key}', 'down')">Down</a>
                    </td>
                </tr>`;
            }
        });
        if (rows) App.el('contest-body').innerHTML = rows;
    }

    static async myContests() {
        let contests = {};
        let predictions = await App.list('prediction');
        predictions.forEach(obj => {
            if (obj.data.userId === window.user.key)
                contests[obj.data.contestId] = obj.data.prediction;
        });
        return contests;
    }

    static async predict(contestId, prediction) {
        App.spin('contest-body');
        if (!window?.user?.key) {
            alert('User session is invalid. Please re-authenticate.')
            await App.logout();
        }
        else {
            let contest = await App.get('contest', contestId);
            if (contest) {
                let key = window.user.key+'||'+contestId;
                let description = `contestId ${contestId} userId ${window.user.key}`;
                let existing = await App.get('prediction', key);
                if (existing) { // just update existing prediction
                    console.log('updating existing prediction');
                    existing.prediction = prediction;
                    await App.set('prediction', existing, key);
                    window.user.contests[contestId] = prediction;
                }
                else { // new prediction is needed so adjust balances accordingly

                    console.log('creating a new prediction');

                    if (contest.buyin > window.user.wallet.balance) {
                        alert('You do not have enough points to join this contest');
                    }
                    // deduct wallet balance
                    let wallet = await App.get('wallet', window.user.key);
                    wallet.balance -= contest.buyin;
                    await App.set('wallet', wallet, window.user.key);

                    // increment contest bets
                    contest.bets += 1;
                    await App.set('contest', contest, contestId);

                    // store prediction by user+contest 
                    await App.set('prediction', {
                        contestId, 
                        userId:window.user.key, 
                        prediction, 
                        description
                    }, key);
                    window.user.contests[contestId] = prediction;
                }
                await App.welcome();
            }
        }
    }

    static async admin() {
        if (window.user.admin) {
            await App.swap('content', 'admin.html');
            await App.loadAdmin();
        }
    }

    // --- ADMIN FUNCTIONS ---//
    static async createContests() {
        App.spin('adminSubmit')
        let data = App.serialize('contest');
        let buyins = [5, 10, 20, 50, 100]
        for (let i=0; i<buyins.length; i++) {
            if (data) {
                data.buyin = buyins[i];
                data.start = new Date(data.start).getTime();
                data.end = new Date(data.end).getTime();
                data.description = data.market+" "+data.duration+" "+data.buyin
                data.bets = 0;
                data.status = 'active';
                data.result = 'pending';
            }
            await App.set('contest', data);
        }
        App.el('adminSubmit').innerHTML = `<button class="pure-button pure-button-primary" type="submit">Add Contests</button>`;
        return true;
    }


    static async createContest() {
        let data = App.serialize('contest');
        if (data) {
            data.start = new Date(data.start).getTime();
            data.end = new Date(data.end).getTime();
            data.description = data.market+" "+data.duration+" "+data.buyin
            data.bets = 0;
            data.status = 'active';
            data.result = 'pending';
        }
        return await App.set('contest', data);
    }

    static async contestLive(key) {
        let contest  = await App.get('contest', key);
        if (contest) {
            contest.status = 'live';
            await App.set('contest', contest, key);
        }
        await App.loadAdmin();
    }

    static async closeContest(key, result) {
        let contest  = await App.get('contest', key);
        if (contest) {
            let winners = [];
            let predictions = await App.list('prediction');
            predictions.forEach(doc=>{
                let pred = doc.data;
                if (pred.contestId === key && pred.prediction === result) 
                    winners.push(pred);
            });
            let count = winners.length;
            alert(count);
            let payout = Math.floor(contest.buyin * contest.bets / count);
            for (let i=0; i<count; i++) {
                let wallet = await App.get('wallet', winners[i].userId);
                if (wallet) {
                    wallet.balance += payout;
                    await App.set('wallet', wallet, winners[i].userId);
                }
            }
            contest.result = result;
            contest.status = 'done';
            await App.set('contest', contest, key);
        }
    }

    static async loadAdmin(filter) {
        App.spin('contest-body');
        let contests = await App.list('contest', filter);
        let rows = ''
        contests.forEach(obj => {
            let contest = obj.data;
            let key = obj.key;
            rows+=`<tr>
            <td>${contest.buyin} Points</td>
            <td>
                <img class="contest-icon" src="/img/${contest.market.substring(0,3)}.png"><br/>
                ${contest.market}
            </td>
            <td>
                <span>${contest.duration}</span><br/>
                <span>${new Date(contest.start).toLocaleDateString('en-US')} - ${new Date(contest.end).toLocaleDateString('en-US')}</span>
            </td>
            <td>${parseInt(contest.bets||0) * parseInt(contest.buyin||0)}</td>
            <td>`
            if (contest.status === 'active') rows+= `<a href="#" class="pure-button up" onclick="app.contestLive('${key}')">Make Live</a>`;
            else if (contest.status === 'live') {
                rows += `<a href="#" class="pure-button up" onclick="app.closeContest('${key}', 'up')">Up</a>
                <a href="#" class="pure-button down" onclick="app.closeContest('${key}', 'down')">Down</a>`;
            }
            rows += `</td></tr>`;
        });
        if (rows) App.el('contest-body').innerHTML = rows;
    }
    
}
window.app = App;


