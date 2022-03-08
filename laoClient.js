'use strict';
// @ts-check

/** @typedef {{Ref:string, Role:number, Hash:string, Name:string}} laoUser */

/** @typedef {{name:string, repres:string, visible:boolean}} laoTablColumn */

/** @type {userBlock} */
var user;
var userTable;

var fUserList;

var listRole = ['пользователь', 'админ'];

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
    clear() {
        this.elm.innerHTML = '';
    }
}

class laoDropdown extends laoElement {
    constructor(parent, name, fn) {
        super('div', parent);
        this.input = createInput(name, '', { noLable: true });
        this.input.disabled = true;
        this.elm.append(this.input);
        this.list = document.createElement('ul');
        this.elm.append(this.list);
        this.fn = fn;

        this.elm.classList.add('common-dropdown');
        this.list.classList.add('input-width');
    }
    addElement(value, repres) {
        var elm = document.createElement('li');
        elm.dataset.value = value;
        elm.innerHTML = repres;
        elm.onclick = (ev) => { this.change(ev) };
        this.list.append(elm);
    }
    change(e) {
        this.input.value = e.target.innerHTML;
        this.input.dataset.value = e.target.dataset.value;
        this.list.style.display = 'none';
        setTimeout(() => { this.list.style.display = '' }, 500);
        if (this.fn) this.fn();
    }
}

class TableElement extends laoElement {
    constructor(parent) {
        super('table', parent);
        this.elm.createTHead();
        this.elm.createTBody();
        this.elm.tHead.insertRow();
        this.elm.classList.add('common-table');
    }
    /**
     * 
     * @param {laoTablColumn} col 
     */
    addColumn(col) {
        if (col.visible === undefined) col.visible = true;

        var cell = this.elm.tHead.rows[0].insertCell();
        cell.dataset.name = col.name;
        cell.innerHTML = col.repres;

        if (!col.visible) cell.style.display = 'none';
    }
    loadData(arr) {
        var row = this.elm.tHead.rows[0];
        for (let i = 0; i < arr.length; i++) {
            var nRow = this.elm.tBodies[0].insertRow();
            for (let iCol = 0; iCol < row.cells.length; iCol++) {
                var cell = nRow.insertCell();
                cell.innerHTML = arr[i][row.cells[iCol].dataset.name];
                cell.style.display = row.cells[iCol].style.display;
            }

        }
    }
    clear() {
        this.elm.tBodies[0].innerHTML = '';
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
        cont.append(createInput('password', 'пароль:', { pwd: true }));

        document.forms.login.append(createButton('Ок', ev => this.login()));

        this.innerForm.classList.add('form-element');
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

        if (!fUserList)
            fUserList = new formUserList();
        else {
            fUserList.update();
        }

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

/**
 * список пользователей
 */
class formUserList extends laoElement {
    constructor(parent) {
        super('div', parent)

        var wsDIV = document.createElement('div');
        this.elm.append(wsDIV);

        var comPanel = document.createElement('div');
        wsDIV.append(comPanel);
        comPanel.append(createButton('Добавить пользователя', ev => { this.newUser() }));

        this.userTable = new TableElement(wsDIV);

        this.userTable.addColumn({ name: 'Name', repres: 'Наименование' });
        this.userTable.addColumn({ name: 'Role', repres: 'Роль' });
        this.userTable.addColumn({ name: 'Ref', repres: '', visible: false });

        this.elm.classList.add('form-common');
        wsDIV.classList.add('form-work-space');
        comPanel.classList.add('command-panel');

        this.update();
    }
    onLoad(result) {
        this.userTable.clear();
        for (let i = 0; i < result.length; i++) {
            result[i]['Role'] = listRole[result[i]['Role']];
        }
        this.userTable.loadData(result);
    }
    update() {
        new ServerCall(
            result => { this.onLoad(result) },
            'getUserList'
        );
    }
    newUser() {
        new formUser();
    }
}

class formUser extends formBlocking {
    constructor() {
        super(true);

        var elmForm = document.createElement('form');
        elmForm.name = 'UserForm';
        this.innerForm.append(elmForm);

        var cont = createContainer('head');
        elmForm.append(cont);

        cont.append(createInput('login', 'пользователь:'));
        cont.append(createInput('Name', 'Отображаемое имя:'));
        cont.append(createInput('PWD', 'пароль:'));

        var elm = document.createElement('label');
        elm.innerHTML = 'роль:';
        cont.append(elm);

        var liRol = new laoDropdown(elm, 'Role');
        liRol.addElement(0, 'админ');
        liRol.addElement(1, 'пользователь');

        elmForm.append(createButton('Ок', ev => this.save()));

        this.innerForm.classList.add('form-element');
    }
    save() {
        this.remove();
    }
}

function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode('0x' + p1);
    }));
}

function createInput(name, value, params = {}) {
    var input = document.createElement('input');
    input.name = name;
    input.type = params.pwd ? 'password' : 'text';
    input.classList.add('input-width');

    if (params.noLable) {
        return input;
    }

    var lable = document.createElement('label');
    lable.innerHTML = value;

    if (params.cont) {
        params.cont.append(input);
        lable.append(params.cont);
    } else {
        lable.append(input);
    }

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

    new formLogin()
}