"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sql = require('mssql');
const _ = require("lodash");
const util_1 = require("util");
// import {EMLINK} from 'constants';
//import {RedisStorage, LabShareCache} from "@labshare/services-cache";
const NodeCache = require('node-cache');
const dotenv = require('dotenv');
dotenv.config();
const CryptoJS = require('crypto-js');
class ErrorObj {
    constructor(code, message) {
        this.code = code;
        this.message = message;
    }
}
exports.ErrorObj = ErrorObj;
class PullRequest {
}
class GUser {
}
exports.GUser = GUser;
class JiraUser {
}
exports.JiraUser = JiraUser;
/*
  TenantId is GitId for the logged in user
*/
class SQLRepository {
    constructor(obj) {
        this.sqlConfigSetting = {};
        this.CACHE_DURATION_SEC = 6000; //50 min
        this.MESSAGE_LEN = 2000;
        this.TENANT_LEN = 50;
        this.ORG_LEN = 200;
        this.STATUS_LEN = 50;
        this.REPO_LEN = 200;
        this.REPO_ID_LEN = 100;
        this.URL_LEN = 2000;
        this.STATE_LEN = 50;
        this.ACTION_LEN = 50;
        this.TITLE_LEN = 2000;
        this.BODY_LEN = 2000;
        this.LOGIN_LEN = 100;
        this.AVATAR_URL_LEN = 2000;
        this.USER_URL_LEN = 2000;
        //for get calls there may not be any obj
        if (obj) {
            this.pr = this.shredObject(obj);
            this.raw = obj.body;
        }
        if (!this.myCache) {
            this.myCache = new NodeCache({ stdTTL: this.CACHE_DURATION_SEC, checkperiod: 120 });
            // this.myCache  = new LabShareCache(new RedisStorage(
            //   {
            //        "host": "gator-cache.redis.cache.windows.net",
            //        "port": 6379
            //   }));
        }
        this.createPool().catch(ex => {
            console.log(`[E] create pool failed: ${ex}`);
        });
    }
    createPool() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.pool) {
                this.sqlConfigSetting.server = process.env.SQL_Server;
                this.sqlConfigSetting.database = process.env.SQL_Database;
                this.sqlConfigSetting.user = process.env.SQL_User;
                this.sqlConfigSetting.password = process.env.SQL_Password;
                this.sqlConfigSetting.port = 1433;
                this.sqlConfigSetting.encrypt = true;
                // this.sqlConfigSetting.options = '{ trustedConnection: true} ';
                // this.sqlConfigSetting.driver = 'msnodesqlv8';
                yield new sql.ConnectionPool(this.sqlConfigSetting).connect().then((pool) => {
                    this.pool = pool;
                });
            }
        });
    }
    //return 0 if not a valid user or the token more than 7 days old
    checkUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'CheckUser: ' + userId;
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('Id', sql.Int, userId);
                const recordSet = yield request.execute('CheckTenant');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset[0].Result === 1);
                    return recordSet.recordset[0].Result === 1;
                }
                else
                    return false;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return false;
            }
        });
    }
    getLoggedInUSerDetails(userId, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getLoggedInUSerDetails: ' + userId;
            try {
                if (!bustTheCache) {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('UserId', sql.Int, userId);
                const recordSet = yield request.execute('getLoggedInUSerDetails');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset[0]);
                    return recordSet.recordset[0];
                }
                else
                    return false;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return false;
            }
        });
    }
    // dropTokenFromCache(tenantId: string) {
    //   let cacheKey = 'checkUser: ' + tenantId;
    //   this.myCache.del(cacheKey);
    //   cacheKey = 'GetUser-' + tenantId;
    //   this.myCache.del(cacheKey);
    // }
    dropJiraTokenFromCache(tenantId) {
        let cacheKey = 'CheckJiraToken: ' + tenantId;
        this.myCache.del(cacheKey);
        console.log('dropJiraTokenFromCache: ' + cacheKey);
        cacheKey = 'getJiraTenant-' + tenantId;
        this.myCache.del(cacheKey);
    }
    //return 0 if not a valid user or the token more than 7 days old
    checkJiraToken(tenantId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'CheckJiraToken: ' + tenantId;
            try {
                tenantId = tenantId.trim();
                // console.log (cacheKey);
                const val = this.myCache.get(cacheKey);
                if (val) {
                    //console.log('jira Token from cache');
                    return val;
                }
                else {
                    //console.log('jira Token from DB');
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('Id', sql.Char, tenantId);
                const recordSet = yield request.execute('CheckJiraTenant');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset[0].Result === 1);
                    return recordSet.recordset[0].Result === 1;
                }
                else
                    return false;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey} -  ${ex}`);
                return false;
            }
        });
    }
    getRepoPR(org, repo, day, pageSize) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'GetRepoPR' + org + repo + day;
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('repo', sql.VarChar(this.REPO_LEN), repo);
                request.input('org', sql.VarChar(this.ORG_LEN), org);
                request.input('day', sql.Int, day);
                request.input('PageSize', sql.Int, pageSize);
                const recordSet = yield request.execute('GetRepoPR');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else
                    return false;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey} - ${ex}`);
                return false;
            }
        });
    }
    getAllRepoCollection4TenantOrg(tenantId, org, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getAllRepoCollection4TenantOrg' + org + tenantId;
            try {
                if (!bustTheCache) {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('TenantId', sql.Int, Number(tenantId));
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                const recordSet = yield request.execute('[GetAllRepoCollection4TenantOrg]');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else
                    return false;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey} - ${ex}`);
                return false;
            }
        });
    }
    //No caller
    GetOrgDetail4UserId_Org(userId, org, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `GetOrgDetail4UserId_Org: ${userId} org: ${org}`;
            try {
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('org', sql.VarChar(this.ORG_LEN), org);
                request.input('UserId', sql.Int, Number(userId));
                const recordSet = yield request.execute('GetOrgDetail4UserId_Org');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    // Date, Ctr, State (open, closed) will be returned
    GetGraphData4XDays(org, day, login, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'GetGraphData4XDays-' + org + login + day;
            try {
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('Day', sql.Int, day);
                request.input('Login', sql.VarChar(this.LOGIN_LEN), login);
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                const recordSet = yield request.execute('GetGraphData4XDays');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    saveStatus(tenantId, status, message = '') {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const request = yield this.pool.request();
                if (!message) {
                    message = '';
                }
                else {
                    if (message.length >= this.MESSAGE_LEN) {
                        message = message.substr(0, this.MESSAGE_LEN - 2);
                    }
                }
                request.input('status', sql.VarChar(this.STATUS_LEN), status);
                request.input('message', sql.VarChar(this.MESSAGE_LEN), message);
                request.input('TenantId', sql.Int, Number(tenantId));
                const recordSet = yield request.execute('saveStatus');
                if (recordSet) {
                    return recordSet.rowsAffected.length;
                }
                else {
                    return 0;
                }
            }
            catch (ex) {
                console.log(`[E]  saveStatus: ${tenantId} ${status}  Error: ${ex}`);
                return 0;
            }
        });
    }
    getRepo(tenantId, org, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `GetRepo: tenantId: ${tenantId} org: ${org}`;
            try {
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('TenantId', sql.Int, Number(tenantId));
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                const recordSet = yield request.execute('GetRepos');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    //returbs   // [{"Org":"LabShare","DisplayName":"LabShare",OrgType: git ot Org}
    getOrg4UserId(userId, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getOrg4UserId' + userId;
            try {
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('UserId', sql.Int, Number(userId));
                const recordSet = yield request.execute('GetOrg4UserId');
                if (recordSet.recordset) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    getJiraOrg(tenantId, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const orgs = yield this.getJiraOrgs(tenantId, bustTheCache);
            const val = orgs[0].id; //default returning the first one
            return val;
        });
    }
    getJiraOrgs(tenantId, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'GetJiraOrgs:' + tenantId;
            let orgs;
            try {
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('TenantId', sql.Char, tenantId);
                const recordSet = yield request.execute('GetJiraOrg');
                if (recordSet.recordset) {
                    orgs = JSON.parse(recordSet.recordset[0].AccessibleResources);
                    this.myCache.set(cacheKey, orgs);
                }
                else {
                    console.log(cacheKey + ' NOT Found orgs!!!');
                }
                return orgs;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return orgs;
            }
        });
    }
    getJiraUsers(tenantId, org, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = `getJiraUsers: tenantId: ${tenantId}  org: ${org}`;
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('TenantId', sql.Char, tenantId);
                request.input('Org', sql.Char, org);
                const recordSet = yield request.execute('GetJiraUsers');
                if (recordSet.recordset.length > 0) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else
                    return null;
            }
            catch (ex) {
                console.log(`[E]  getJiraUsers id: ${tenantId} org: ${org} Error: ${ex}`);
                return null;
            }
        });
    }
    //No one calls this yet, the SP is called directly from another SP GetUser.
    //Leaving for future use.
    setActiveTenant(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('TenantId', sql.Int, id);
                const recordSet = yield request.execute('SaveActiveTenant');
                if (recordSet) {
                    return recordSet.rowsAffected.length;
                }
                else
                    return 0;
            }
            catch (ex) {
                console.log(`[E] setActiveTenant id: ${id} Error: ${ex}`);
                return 0;
            }
        });
    }
    //Token will return UserName, DisplayName, ProfileURL, AuthToken, LastUpdated and Photo (URL)
    getUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cacheKey = 'getUser-' + id;
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('Id', sql.Int, id);
                const recordSet = yield request.execute('GetUser');
                if (recordSet.recordset.length > 0) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else
                    return 0;
            }
            catch (ex) {
                console.log(`[E] getUser id: ${id} Error: ${ex}`);
                return 0;
            }
        });
    }
    getJiraTenant(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getJiraTenant-' + id;
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    console.log('getJiraTenant hitting the cache');
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('Id', sql.Char, id);
                const recordSet = yield request.execute('GetJiraTenant');
                if (recordSet.recordset.length > 0) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else
                    return 0;
            }
            catch (ex) {
                console.log(`[E] ]  ${cacheKey}  Error: ${ex}`);
                return 0;
            }
        });
    }
    //GetPR4Repo
    getPR4Repo(org, repo, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createPool();
            const cacheKey = 'GetPR4Repo -' + org + repo;
            try {
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                else {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                const request = yield this.pool.request();
                request.input('org', sql.VarChar(this.ORG_LEN), org);
                request.input('repo', sql.VarChar(this.REPO_LEN), repo);
                const recordSet = yield request.execute('GetPR4Repo');
                if (recordSet.recordset.length > 0) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else {
                    return 0;
                }
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return 0;
            }
        });
    }
    //saveOrgChart
    saveOrgChart(userId, org, orgChart) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('org', sql.VarChar(this.ORG_LEN), org);
                request.input('userId', sql.VarChar(this.LOGIN_LEN), userId);
                request.input('orgChart', sql.VarChar, orgChart);
                const recordSet = yield request.execute('SaveOrgChart');
                if (recordSet.recordset.length > 0) {
                    return recordSet.recordset;
                }
                else {
                    return 0;
                }
            }
            catch (ex) {
                console.log(`[E]  SaveOrgChart:  Error: ${ex}`);
                return 0;
            }
        });
    }
    //saveOrgChart
    getOrgChart(org, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createPool();
            const cacheKey = 'getOrgChart -' + org;
            try {
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                else {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                const request = yield this.pool.request();
                request.input('org', sql.VarChar(this.ORG_LEN), org);
                const recordSet = yield request.execute('getOrgChart');
                if (recordSet.recordset.length > 0) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else {
                    return 0;
                }
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return 0;
            }
        });
    }
    getToken4User(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getUser -' + id; //cacheKey is getUser because i am reading there cache value. This is different from norm
            const val = this.myCache.get(cacheKey);
            if (val) {
                // return this.decrypt(val.recordset[0].Auth_Token, id.toString());
                return val.recordset[0].Auth_Token;
            }
            const recordSet = yield this.getUser(id);
            if (recordSet) {
                //return this.decrypt(recordSet[0].Auth_Token, id.toString());
                return recordSet[0].Auth_Token;
            }
            else
                return;
        });
    }
    getJiraToken(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const recordSet = yield this.getJiraTenant(id);
            if (recordSet)
                return recordSet[0].Auth_Token;
            else
                return;
        });
    }
    getTopDev4LastXDays(org, day = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getTopDev4LastXDays' + org + day;
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                if (!org) {
                    throw new Error('tenant cannot be null');
                }
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                request.input('Day', sql.Int, day);
                const recordSet = yield request.execute('TopDevForLastXDays');
                if (recordSet.recordset) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else {
                    return;
                }
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return;
            }
        });
    }
    getGitDev4Org(org) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getGitDev4Org' + org;
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                if (!org) {
                    throw new Error('org cannot be null');
                }
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                const recordSet = yield request.execute('GitDev4Org');
                if (recordSet.recordset) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                else {
                    return;
                }
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return;
            }
        });
    }
    GetRepoParticipation4Login(org, login, days = 30, bustTheCache = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `GetRepoParticipation4Login: org: ${login} ${org} ${days}`;
            try {
                if (bustTheCache) {
                    this.myCache.del(cacheKey);
                }
                else {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                yield this.createPool();
                const request = yield this.pool.request();
                if (!org) {
                    throw new Error('org cannot be null');
                }
                request.input('org', sql.VarChar(this.ORG_LEN), org);
                request.input('login', sql.VarChar(this.LOGIN_LEN), login);
                request.input('days', sql.Int, days);
                const recordSet = yield request.execute('GetRepoParticipation4Login');
                if (recordSet.recordset) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                return recordSet;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    getPR4Id(org, id = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = `getPR4Id: org:  ${org} id ${id}`;
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                if (!org) {
                    throw new Error('org cannot be null');
                }
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                request.input('Id', sql.Int, id);
                const recordSet = yield request.execute('GetPR4Id');
                if (recordSet.recordset) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                    return recordSet.recordset;
                }
                return recordSet;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    getPRCount4LastXDays(org, login, day = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createPool();
            const cacheKey = 'PRCount4LastXDays' + org + login + day.toString();
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                const request = yield this.pool.request();
                if (!org) {
                    throw new Error('org cannot be null');
                }
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                request.input('Login', sql.VarChar(this.LOGIN_LEN), login);
                request.input('Day', sql.Int, day);
                const recordSet = yield request.execute('PRCount4LastXDays');
                if (recordSet.recordset.length > 0) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    getPR4Dev(org, day = 1, login, action, pageSize) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!org) {
                console.log(`[i] Exiting getPRDev org cannot be null`);
                return;
            }
            if (util_1.isNullOrUndefined(login) || login === '') {
                login = 'null';
            }
            const cacheKey = 'getPR4Dev' + org + day.toString() + login + action;
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                if (pageSize === 0)
                    pageSize = 10;
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                if (util_1.isNullOrUndefined(login) || login === '') {
                    request.input('Login', sql.VarChar(this.LOGIN_LEN), 'null');
                }
                else {
                    request.input('Login', sql.VarChar(this.LOGIN_LEN), login);
                }
                if (util_1.isNullOrUndefined(action) || action === '') {
                    request.input('Action', sql.VarChar(this.ACTION_LEN), 'null');
                }
                else {
                    request.input('Action', sql.VarChar(this.ACTION_LEN), action);
                }
                request.input('Day', sql.Int, day);
                request.input('pageSize', sql.Int, pageSize);
                const recordSet = yield request.execute('PR4Devs');
                // console.log(`getPR4Dev records found: ${recordSet.recordset.length}`);
                if (recordSet.recordset.length > 0) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    /*
    PullRequest took longest time between open and close
    */
    getLongestPR(org, day = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createPool();
            const request = yield this.pool.request();
            if (!org) {
                throw new Error('org cannot be null');
            }
            request.input('Org', sql.VarChar(this.ORG_LEN), org);
            request.input('Day', sql.Int, day);
            const recordSet = yield request.execute('LongestPR');
            return recordSet.recordset;
        });
    }
    getTopRepo4XDays(org, day = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getTopRepo4XDays' + org + day.toString();
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                if (!org) {
                    throw new Error('org cannot be null');
                }
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                request.input('Day', sql.Int, day);
                const recordSet = yield request.execute('GetTopRepos4XDays');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    getPR4LastXDays(org, day = 1) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getPR4LastXDays' + org + day.toString();
            try {
                const val = this.myCache.get(cacheKey);
                if (val) {
                    return val;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                if (!org) {
                    throw new Error('org cannot be null');
                }
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                request.input('Day', sql.Int, day);
                const recordSet = yield request.execute('PR4LastXDays');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    getItem(query, page, pageSize) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const request = yield this.pool.request();
                const rs = yield request.query(query);
                const results = rs.recordset;
                if (isNaN(page)) {
                    page = 1;
                }
                if (page === 0) {
                    page = 1;
                }
                if (isNaN(pageSize)) {
                    pageSize = 10;
                }
                if (pageSize === 0) {
                    pageSize = 10;
                }
                let s = '[';
                let ctr = 0;
                let startCtr = (page - 1) * pageSize;
                if (startCtr === 0) {
                    startCtr = 1;
                }
                let endCtr = page * pageSize;
                if (endCtr > results.length) {
                    endCtr = results.length;
                }
                for (const result of results) {
                    ctr = ctr + 1;
                    if (ctr >= startCtr && ctr <= endCtr) {
                        s = s + JSON.stringify(result);
                        if (ctr < endCtr) {
                            s = s + ','; //last element does not need the comma
                        }
                    }
                }
                s = s + ']';
                return s;
            }
            catch (err) {
                console.log(`[E]  ${err}`);
            }
        });
    }
    saveJiraUser(user) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const request = yield this.pool.request();
                if (!user.Photo) {
                    user.Photo = '';
                }
                if (!user.DisplayName) {
                    user.DisplayName = '';
                }
                //Token is kept decrypted in DB
                const token = user.AuthToken; //No Encryption for Jira
                request.input('Id', sql.Char, user.Id);
                request.input('email', sql.VarChar(200), user.Email);
                request.input('UserName', sql.VarChar(200), user.UserName);
                request.input('DisplayName', sql.VarChar(200), user.DisplayName);
                request.input('ProfileUrl', sql.Char(500), user.ProfileUrl);
                request.input('AuthToken', sql.VARCHAR(4000), token);
                request.input('RefreshToken', sql.VARCHAR(4000), user.RefreshToken);
                request.input('Photo', sql.Char(500), user.Photo);
                request.input('AccessibleResources', sql.Char(8000), JSON.stringify(user.AccessibleResources));
                const recordSet = yield request.execute('SaveJiraTenant');
                return recordSet.rowsAffected[0];
            }
            catch (ex) {
                console.log(`[E]  ${ex}`);
                return 0;
            }
        });
    }
    saveMSR(srId, userId, org, statusDetails, reviewer, status, links, manager, managerComment, managerStatus) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'saveMSR' + srId;
            try {
                this.myCache.del(cacheKey);
                const request = yield this.pool.request();
                request.input('SRId', sql.Int, srId);
                request.input('UserId', sql.VarChar(100), userId);
                request.input('Org', sql.VarChar(200), org);
                request.input('StatusDetails', sql.VarChar(10000), statusDetails);
                request.input('Reviewer', sql.VarChar(500), reviewer);
                request.input('Status', sql.Int, status);
                request.input('Links', sql.VarChar(1000), links);
                request.input('Manager', sql.VarChar(1000), manager);
                request.input('ManagerComment', sql.VarChar(4000), managerComment);
                request.input('ManagerStatus', sql.Int, managerStatus);
                const recordSet = yield request.execute('SaveMSR');
                return recordSet.rowsAffected[0];
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return 0;
            }
        });
    }
    getSR4Id(srId, bustTheCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getMSR4Id' + srId;
            try {
                if (!bustTheCache) {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                const request = yield this.pool.request();
                request.input('Id', sql.Int, srId);
                const recordSet = yield request.execute('GetSR4Id');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    getSR4User(userId, bustTheCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getSR4User' + userId;
            try {
                if (!bustTheCache) {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                const request = yield this.pool.request();
                request.input('UserId', sql.VarChar(100), userId);
                const recordSet = yield request.execute('GetSR4User');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    GetSR4User4Review(userId, status, userFilter = null, dateFilter = null, bustTheCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'GetSR4User4Review' + userId + status;
            try {
                userFilter = userFilter.trim();
                dateFilter = dateFilter.trim();
                const request = yield this.pool.request();
                request.input('UserId', sql.VarChar(100), userId);
                request.input('Status', sql.Int, status);
                request.input('UserFilter', sql.VarChar, userFilter != 'null' ? userFilter : null);
                request.input('DateFilter', sql.VarChar(50), dateFilter != 'null' ? dateFilter : null);
                const recordSet = yield request.execute('GetSR4User4Review');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey}  Error: ${ex}`);
                return null;
            }
        });
    }
    /* save */
    saveLoggedInUser(user) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const request = yield this.pool.request();
                if (!user.Photo) {
                    user.Photo = '';
                }
                if (!user.DisplayName) {
                    user.DisplayName = '';
                }
                // const token = this.encrypt(user.AuthToken, user.Id.toString());
                request.input('Id', sql.Int, user.Id);
                request.input('email', sql.VarChar(200), user.Email);
                request.input('UserName', sql.VarChar(200), user.UserName);
                request.input('DisplayName', sql.VarChar(200), user.DisplayName);
                request.input('ProfileUrl', sql.VarChar(1000), user.ProfileUrl);
                request.input('AuthToken', sql.VarChar(4000), user.AuthToken);
                request.input('RefreshToken', sql.VarChar(4000), user.RefreshToken);
                request.input('Photo', sql.VarChar(1000), user.Photo);
                const recordSet = yield request.execute('SaveTenant');
                return recordSet.rowsAffected[0];
            }
            catch (ex) {
                console.log(`[E]  saveLoggedInUSer ${user} ${ex}`);
                return ex;
            }
        });
    }
    encrypt(token, secret) {
        const ciphertext = CryptoJS.AES.encrypt(token, secret);
        return ciphertext;
    }
    decrypt(token, secret) {
        const bytes = CryptoJS.AES.decrypt(token, secret);
        const plaintext = bytes.toString(CryptoJS.enc.Utf8);
        return plaintext;
    }
    /*
      Saves only action === 'opened' || action === 'closed' || action === 'edited'
    */
    savePR4Repo(org, repo, body) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const pr = JSON.parse(body);
                let id;
                let url;
                let state;
                let title;
                let created_at;
                let pr_body;
                let login;
                let avatar_url;
                let user_url;
                const request = yield this.pool.request();
                const nodes = pr.data.viewer.organization.repository.pullRequests.nodes;
                if (nodes === undefined) {
                    console.log(`[i] No PR found for org: ${org} Repo: ${repo}`);
                }
                if (nodes.length === 0) {
                    console.log(`[i] No PR found for org: ${org} Repo: ${repo}`);
                }
                if (nodes.length > 0) {
                    console.log(`[i] ${nodes.length} PR found for org: ${org} Repo: ${repo}`);
                }
                //nodes.forEach(async (elm: any) => {
                for (const elm of nodes) {
                    if (elm.author.login === undefined) {
                        console.log('login is invalid');
                        continue;
                    }
                    if (elm.author.login.startsWith('greenkeep'))
                        continue;
                    if (elm.author.login.startsWith('semantic-release-bot'))
                        continue;
                    if (elm.action === 'opened' || elm.action === 'closed' || elm.action === 'edited') {
                        //move on
                    }
                    else {
                        continue;
                    }
                    id = elm.id;
                    url = elm.url;
                    state = elm.action; //Found out state has too much noise but action open and close is better
                    title = elm.title;
                    created_at = elm.createdAt;
                    pr_body = elm.body;
                    if (!pr_body) {
                        pr_body = ' ';
                    }
                    if (pr_body.length > 1999) {
                        pr_body = pr_body.substr(0, 1998);
                    }
                    login = elm.author.login;
                    avatar_url = elm.author.avatarUrl;
                    user_url = elm.author.url;
                    request.input('Id', sql.VarChar(200), id);
                    request.input('Org', sql.VarChar(this.ORG_LEN), org);
                    request.input('Repo', sql.VarChar(this.REPO_LEN), repo);
                    request.input('Url', sql.VarChar(this.URL_LEN), url);
                    request.input('State', sql.VarChar(this.STATE_LEN), state);
                    request.input('Title', sql.VarChar(this.TITLE_LEN), title);
                    request.input('Created_At', sql.VarChar(20), created_at);
                    request.input('Body', sql.VarChar(this.BODY_LEN), pr_body);
                    request.input('Login', sql.VarChar(this.LOGIN_LEN), login);
                    request.input('Avatar_Url', sql.VarChar(this.AVATAR_URL_LEN), avatar_url);
                    request.input('User_Url', sql.VarChar(this.USER_URL_LEN), user_url);
                    try {
                        const x = yield request.execute('SavePR4Repo');
                        return x.rowsAffected[0];
                    }
                    catch (ex) {
                        console.log(`[E]  Error! While saving PR for org:${org} repo: ${repo} - ${ex}`);
                    }
                }
            }
            catch (ex) {
                console.log(`[E]  savePR4Repo ${org} ${repo}`);
                return false;
            }
            return true;
        });
    }
    /* return number of orgs */
    saveUserOrg(userId, org) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('UserId', sql.Int, Number(userId));
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                request.input('DisplayName', sql.VarChar(this.ORG_LEN), org);
                yield request.execute('SaveUserOrg');
                return org.length;
            }
            catch (ex) {
                console.log(`[E]  saveUserOrg: ${userId} ${org} ${ex}`);
                return 0;
            }
        });
    }
    saveOrgs(userId, orgs) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.createPool();
                const request = yield this.pool.request();
                for (const o of orgs) {
                    const org = o;
                    request.input('UserId', sql.Int, Number(userId));
                    if (org.url) {
                        request.input('Org', sql.VarChar(this.ORG_LEN), org.url.substr('https://github.com/'.length));
                        request.input('DisplayName', sql.VarChar(this.ORG_LEN), org.name);
                    }
                    else {
                        request.input('Org', sql.VarChar(this.ORG_LEN), org);
                        request.input('DisplayName', sql.VarChar(this.ORG_LEN), org);
                    }
                    yield request.execute('SaveUserOrg');
                }
                return orgs.length;
            }
            catch (ex) {
                console.log(`[E]  saveOrgs: ${userId} ${orgs} ${ex}`);
                return 0;
            }
        });
    }
    saveJiraUsers(tenantId, org, devs) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (devs === undefined)
                    return;
                if (devs.length === 0) {
                    console.log('No devs to be saved!');
                    return;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                for (const d of devs) {
                    let dev = d;
                    // const createdAt = String(dev.createdAt).substr(0, 10);
                    request.input('TenantId', sql.Char, tenantId);
                    request.input('Org', sql.VarChar(this.ORG_LEN), org); //
                    request.input('accountId', sql.VarChar(100), dev.accountId); //rsarosh@hotmail.com
                    request.input('displayName', sql.VarChar(200), dev.displayName); //Rafat Sarosh
                    request.input('avatarUrls', sql.Text, JSON.stringify(dev.avatarUrls)); //rsarosh
                    request.input('self', sql.VarChar(500), dev.self);
                    yield request.execute('SaveJiraUsers');
                }
            }
            catch (ex) {
                console.log(`[E]  saveJiraUsers: ${tenantId} ${org} ${ex}`);
                return ex;
            }
        });
    }
    saveDevs(org, devs) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (devs === undefined)
                    return;
                if (devs.length === 0) {
                    console.log('No devs to be saved!');
                    return;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                for (const d of devs) {
                    let dev = d;
                    request.input('Org', sql.VarChar(this.ORG_LEN), org); //
                    request.input('email', sql.VarChar(200), dev.email); //rsarosh@hotmail.com
                    request.input('name', sql.VarChar(200), dev.name); //Rafat Sarosh
                    request.input('login', sql.VarChar(this.LOGIN_LEN), dev.login); //rsarosh
                    request.input('avatarUrl', sql.VarChar(1200), dev.avatarUrl);
                    yield request.execute('SaveDev');
                    //return recordSet.rowsAffected[0];
                }
                // console.log(`saved ${devs.length} Git Dev`);
                return devs.length;
            }
            catch (ex) {
                console.log(`[E]  saveDevs:  ${org} ${ex}`);
                return 0;
            }
        });
    }
    saveRepo(tenantId, org, repos) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (repos === undefined)
                    return;
                if (repos.length === 0) {
                    console.log('No repo to be saved!');
                    return;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                for (const r of repos) {
                    let repo = r;
                    const createdAt = String(repo.createdAt).substr(0, 10);
                    // console.log(`SaveRepo = org: ${org} repo: ${repo.name}`);
                    request.input('TenantId', sql.Int, Number(tenantId));
                    request.input('Org', sql.VarChar(this.ORG_LEN), org);
                    request.input('Id', sql.VarChar(this.REPO_ID_LEN), repo.id);
                    request.input('name', sql.VarChar(this.REPO_LEN), repo.name);
                    request.input('desc', sql.VarChar(200), repo.description);
                    request.input('HomePage', sql.VarChar(200), repo.homepageUrl);
                    request.input('CreatedAt', sql.VarChar(10), createdAt);
                    const recordSet = yield request.execute('SaveRepos');
                    return recordSet.rowsAffected[0];
                }
            }
            catch (ex) {
                console.log(`[E]  saveRepo: ${tenantId} ${org} ${ex}`);
                return 0;
            }
        });
    }
    shredObject(obj) {
        const pr = new PullRequest();
        try {
            pr.Org = _.get(obj.body, 'organization.login');
            pr.Login = _.get(obj.body, 'pull_request.user.login');
            pr.Action = _.get(obj.body, 'action');
            pr.PullRequestId = parseInt(_.get(obj.body, 'number'));
            pr.PullRequestUrl = _.get(obj.body, 'pull_request.url');
            pr.State = _.get(obj.body, 'pull_request.state');
            pr.Avatar_Url = _.get(obj.body, 'pull_request.user.avatar_url');
            pr.User_Url = _.get(obj.body, 'pull_request.user.url');
            pr.Created_At = _.get(obj.body, 'pull_request.created_at');
            pr.Body = _.get(obj.body, 'pull_request.body');
            pr.Teams_Url = _.get(obj.body, 'pull_request.base.repo.teams_url');
            pr.Repo_Name = _.get(obj.body, 'pull_request.base.repo.name');
            pr.Repo_FullName = _.get(obj.body, 'pull_request.base.repo.full_name');
            pr.Repo_Description = _.get(obj.body, 'pull_request.base.repo.description');
            pr.Links = JSON.stringify(_.get(obj.body, 'pull_request._links'));
            pr.PullId = _.get(obj.body, 'pull_request.url');
        }
        catch (err) {
            console.log(`[E]  shredObject ${err}`);
        }
        return pr;
    }
    //UserRole
    getUserRole(loginId, org, bustTheCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getUserRole' + loginId + org;
            try {
                if (!bustTheCache) {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                const request = yield this.pool.request();
                request.input('login', sql.VarChar(100), loginId);
                request.input('org', sql.VarChar(200), org);
                const recordSet = yield request.execute('getUserRole');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey} ${ex}`);
                return ex;
            }
        });
    }
    getRole4Org(org, bustTheCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'getRole4Org' + org;
            try {
                if (!bustTheCache) {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                const request = yield this.pool.request();
                request.input('org', sql.VarChar(200), org);
                const recordSet = yield request.execute('getRole4Org');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey} ${ex}`);
                return ex;
            }
        });
    }
    isUserAdmin(loginId, org, bustTheCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'isUserAdmin' + loginId + org;
            try {
                if (!bustTheCache) {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                const request = yield this.pool.request();
                request.input('login', sql.VarChar(100), loginId);
                request.input('org', sql.VarChar(200), org);
                const recordSet = yield request.execute('IsAdmin');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.returnValue); //1 is true and zero is false
                }
                return recordSet.returnValue;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey} ${ex}`);
                return ex;
            }
        });
    }
    isUserMSRAdmin(loginId, org, bustTheCache) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheKey = 'isUserMSRAdmin' + loginId + org;
            try {
                if (!bustTheCache) {
                    const val = this.myCache.get(cacheKey);
                    if (val) {
                        return val;
                    }
                }
                const request = yield this.pool.request();
                request.input('login', sql.VarChar(100), loginId);
                request.input('org', sql.VarChar(200), org);
                const recordSet = yield request.execute('IsMSRAdmin');
                if (recordSet) {
                    this.myCache.set(cacheKey, recordSet.recordset);
                }
                return recordSet.recordset;
            }
            catch (ex) {
                console.log(`[E]  ${cacheKey} ${ex}`);
                return ex;
            }
        });
    }
    saveUserRole(login, org, role) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!role) {
                    console.log(`saveUserRole [E]  role cannot be null`);
                    return;
                }
                if (!login) {
                    console.log(`saveUserRole [E]  login cannot be null`);
                    return;
                }
                if (!org) {
                    console.log(`saveUserRole [E]  org cannot be null`);
                    return;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('login', sql.VarChar(this.LOGIN_LEN), login);
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                request.input('role', sql.VarChar(100), role);
                const recordSet = yield request.execute('SaveUserRole');
                return recordSet.rowsAffected[0];
            }
            catch (ex) {
                console.log(`[E]  saveUserRole: ${login} ${org} ${ex}`);
                return ex;
            }
        });
    }
    deleteUserRole(login, org, role) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!role) {
                    console.log(`saveUserRole [E]  role cannot be null`);
                    return;
                }
                if (!login) {
                    console.log(`saveUserRole [E]  login cannot be null`);
                    return;
                }
                if (!org) {
                    console.log(`saveUserRole [E]  org cannot be null`);
                    return;
                }
                yield this.createPool();
                const request = yield this.pool.request();
                request.input('login', sql.VarChar(this.LOGIN_LEN), login);
                request.input('Org', sql.VarChar(this.ORG_LEN), org);
                request.input('Role', sql.VarChar(100), role);
                const recordSet = yield request.execute('DeleteUserRole');
                return recordSet.rowsAffected[0];
            }
            catch (ex) {
                console.log(`[E]  deleteUserRole: ${login} ${org} ${ex}`);
                return ex;
            }
        });
    }
}
exports.SQLRepository = SQLRepository;
//# sourceMappingURL=sqlRepository.js.map