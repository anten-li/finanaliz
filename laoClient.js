'use strict';
// @ts-check

/** @typedef {{Ref:string, Role:number, Hash:string, Name:string}} laoUser */

/** @typedef {{name:string, repres:string, visible:boolean}} laoTablColumn */

/** @type {userBlock} */
var user;
var userTable;

class ServerCall {
    constructor(callBackFunc, command, parameters, options) {
        this.callBackFunc = callBackFunc;

        parameters = parameters || {};
        parameters.cmd = command || '';

        options = options || {};
        options.method = options.method || 'POST';
        options.body = JSON.stringify(parameters);

        if (command) {
            options.headers = options.headers || {};
            options.headers.Authorization = 'Bearer ' + user.user.Hash;
            options.headers['Content-Type'] = 'application/json';
        }

        this.block = new formBlocking();

        try {
            fetch('index.php', options).then(
                response => response.ok ? response.json() : new formAlert(response.statusText)).then(
                    response => this.onResponse(response),
                    err => {
                        this.block.remove();
                        new formAlert(err)
                    });
        } catch (error) {
            this.block.remove();
            new formAlert('fetch не поддерживается');
        }
    }
    onResponse(response) {
        this.block.remove();
        if (response.S_Ok) this.callBackFunc(response.result);
        else new formAlert(response.result);
    }
}

class laoElement {
    constructor(elm = 'div', parent = document.body) {
        this.elm = document.createElement(elm);
        parent.append(this.elm);
    }
    remove() {
        this.elm.remove();
    }
}

class TableElement extends laoElement {
    constructor(parent) {
        super('table', parent);
        this.elm.createTHead();
        this.elm.createTBody();
        this.elm.tHead.insertRow();
    }
    /**
     * 
     * @param {laoTablColumn} col 
     */
    addColumn(col) {
        var cell = this.elm.tHead.rows[0].insertCell();
        cell.dataset.name = col.name;
        cell.innerHTML = col.repres;
        if (typeof col.visible != 'undefined' && !col.visible) cell.style.display = 'none';
    }
}

class formBlocking extends laoElement {
    constructor(innerForm = false) {
        super();
        this.elm.classList.add('form-blocking', 'black-transparent');
        if (innerForm) {
            this.innerForm = document.createElement('div');
            this.elm.append(this.innerForm);
            this.innerForm.classList.add('form-background', 'form-border');
        }
    }
}

class formAlert extends formBlocking {
    constructor(text = 'Alert') {
        super(true);

        var elmText = document.createElement('p');
        elmText.innerHTML = text;

        this.innerForm.append(elmText);
        this.innerForm.append(createButton('Ок', () => this.remove()));
    }
}

class formLogin extends formBlocking {
    constructor() {
        super(true);

        if (document.forms.login) throw 'login error';

        var elmForm = document.createElement('form');
        elmForm.name = 'login';
        this.innerForm.append(elmForm);

        var cont = createContainer('head');
        document.forms.login.append(cont);

        cont.append(createInput('login', 'пользователь:'));
        cont.append(createInput('password', 'пароль:', { 'pwd': true }));

        document.forms.login.append(createButton('Ок', ev => this.login()));

        this.innerForm.classList.add('form-login');
    }
    login() {
        new ServerCall(
            result => { this.onResponse(result) },
            undefined, undefined,
            {
                headers: {
                    Authorization: 'Basic ' + b64EncodeUnicode(
                        `${document.forms.login.login.value}:${document.forms.login.password.value}`)
                }
            });
    }
    onResponse(result) {
        user.setUser(result);
        this.remove();

        //
        new formUserList();
        //
    }
}

/**
 * плашка с пользователем и выходом
 */
class userBlock extends laoElement {
    constructor() {
        super();

        this.user = {};
        this.elmUser = document.createElement('span');
        this.elm.append(this.elmUser);

        this.elmExit = document.createElement('span');
        this.elm.append(this.elmExit);
        this.elmExit.innerHTML = 'Выход';
        this.elmExit.onclick = ev => { this.exit() };

        this.elm.classList.add('user-block');
    }
    /**
     * 
     * @param {laoUser} usr 
     */
    setUser(usr) {
        /** @type {laoUser} */
        this.user = usr;
        this.elmUser.innerHTML = this.user.Name;
    }
    exit() {
        this.user = {}
        this.elmUser.innerHTML = '';

        new formLogin();
    }
}

class formUserList extends laoElement {
    constructor(parent) {
        super('div', parent)

        new ServerCall(
            result => { this.onLoad(result) },
            'getUserList'
        );
    }
    onLoad(result) {

    }
}

function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
    }));
}

function createInput(name, value, params = {}) {
    var lable = document.createElement('label');
    lable.innerHTML = value;

    var input = document.createElement('input');
    input.name = name;
    input.type = params.pwd ? 'password' : 'text';
    lable.append(input);

    return lable;
}

function createButton(value, fn) {
    var input = document.createElement('input');
    input.type = 'button';
    input.value = value;
    input.onclick = fn;

    return input;
}

function createContainer(cls) {
    var cont = document.createElement('div');
    if (cls) cont.classList.add(cls);
    return cont;
}

window.onload = ev => {
    user = new userBlock();
    userTable = new TableElement();

    userTable.addColumn({ name: 'name', repres: 'Наименование' });
    userTable.addColumn({ name: 'role', repres: 'Роль' });
    userTable.addColumn({ name: 'ref', repres: '', visible: false });


    new formLogin()
}