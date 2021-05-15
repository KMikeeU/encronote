let newButton, openButton, saveButton;
let editor;
let menu;
let fileEntry;

const {remote, clipboard} = require('electron');
const {Menu, MenuItem, dialog } = remote;
const prompt = remote.require("electron-prompt");
const crypto = remote.require("crypto");

const fs = require("fs");

var key = false;

const AESCrypt = {};

AESCrypt.encrypt = function(cryptKey, crpytIv, plainData) {
    let encipher = crypto.createCipheriv('aes-256-cbc', cryptKey, crpytIv),
    encrypted = encipher.update(plainData, 'utf8', 'binary');

    encrypted += encipher.final('binary');

    return new Buffer.from(encrypted, 'binary').toString('base64');
};

AESCrypt.decrypt = function(cryptKey, cryptIv, encrypted) {
    encrypted = new Buffer.from(encrypted, 'base64').toString('binary');

    let decipher = crypto.createDecipheriv('aes-256-cbc', cryptKey, cryptIv),
    decrypted = decipher.update(encrypted, 'binary', 'utf8');

    decrypted += decipher.final('utf8');

    return decrypted;
};

function handleDocumentChange() {
    editor.setOption("mode", "markdown");
}

function newFile() {
    fileEntry = null;
    handleDocumentChange();
}

function setFile(theFileEntry) {
    fileEntry = theFileEntry;
}

function readFileIntoEditor(theFileEntry) {
    fs.readFile(theFileEntry.toString(), function (err, data) {
        if (err) {
            console.log("Read failed: " + err);
        }
        
        handleDocumentChange(theFileEntry);

        prompt({
            title: "AES Password required",
            type: "input",
            label: "Password:",
            inputAttrs:{
                type: "password"
            }
        }).then(res => {
            key = crypto.createHash('sha256').update(res).digest();

            let parts = data.toString().split("||");
            let iv = Buffer.from(parts[0], "hex");
            let encrypted = parts[1];

            let result = AESCrypt.decrypt(key, iv, encrypted);
            editor.setValue(String(result));

        }).catch(err => {
            dialog.showErrorBox("Invalid AES Password", "The passphrase you entered was invalid and could not be used to decrypt the file.")
        });
    });
}

async function writeEditorToFile(theFileEntry) {
    if(!key){
        try{
            let res;
            let equal = false;
            while(!equal){
                res = await prompt({
                    title: "AES Password required",
                    type: "input",
                    label: "Password:",
                    inputAttrs:{
                        type: "password"
                    }
                })
    
                let res2 = await prompt({
                    title: "Confirm password",
                    type: "input",
                    label: "Password:",
                    inputAttrs:{
                        type: "password"
                    }
                })

                if(res === res2){ equal = true; }
            }
    
            key = crypto.createHash('sha256').update(res).digest();

        }catch(err){
            console.log(err);
            return;
        }
    }

    AESCrypt.makeIv = crypto.randomBytes(16);
    
        
    const encrypted = AESCrypt.encrypt(key, AESCrypt.makeIv, editor.getValue());
    const fileContent = AESCrypt.makeIv.toString("hex") + "||" + encrypted;
        
    fs.writeFile(theFileEntry, fileContent, {flag: "w"}, function (err) {
        if (err) {
            console.log(err);
            return;
        }
            
        handleDocumentChange(theFileEntry);
    });
}

var onChosenFileToOpen = function(theFileEntry) {
    setFile(theFileEntry);
    readFileIntoEditor(theFileEntry);
};

var onChosenFileToSave = function(theFileEntry) {
    setFile(theFileEntry);
    writeEditorToFile(theFileEntry);
};

function handleNewButton() {
    window.open('file://' + __dirname + '/index.html');
}

function handleOpenButton() {
    dialog.showOpenDialog({properties: ['openFile']}).then(res => {
        onChosenFileToOpen(res.filePaths[0].toString()); 
    });
}
    
function handleSaveButton() {
    if (fileEntry) {
        writeEditorToFile(fileEntry);
    } else {
        dialog.showSaveDialog({
            title: "Save EncroNote",
            filter: [{name: "EncroNote", extension: ["encro"]}]
        }).then(res => {
            console.log(`File chosen ${res.filePath}`);
            onChosenFileToSave(res.filePath);
        }).catch(err => console.log(err));
    }
}
    
function initContextMenu() {
    menu = new Menu();
    menu.append(new MenuItem({
        label: 'Copy',
        click: function() {
            clipboard.writeText(editor.getSelection(), 'copy');
        }
    }));
    menu.append(new MenuItem({
        label: 'Cut',
        click: function() {
            clipboard.writeText(editor.getSelection(), 'copy');
            editor.replaceSelection('');
        }
    }));
    menu.append(new MenuItem({
        label: 'Paste',
        click: function() {
            editor.replaceSelection(clipboard.readText('copy'));
        }
    }));
    
    window.addEventListener('contextmenu', function(ev) { 
        ev.preventDefault();
        menu.popup(remote.getCurrentWindow(), ev.x, ev.y);
    }, false);
}


onload = function() {
    initContextMenu();
    
    newButton = document.getElementById("new");
    openButton = document.getElementById("open");
    saveButton = document.getElementById("save");
    
    // newButton.addEventListener("click", handleNewButton);
    // openButton.addEventListener("click", handleOpenButton);
    // saveButton.addEventListener("click", handleSaveButton);
    
    editor = CodeMirror(
        document.getElementById("editor"), {
        mode: {name: "markdown", json: true },
        lineNumbers: true,
        theme: "lesser-dark",
        extraKeys: {
            "Cmd-S": function(instance) { handleSaveButton() },
            "Ctrl-S": function(instance) { handleSaveButton() },
            "Ctrl-N": function(instance) { handleNewButton() },
            "Ctrl-O": function(instance) { handleOpenButton() }
        }
    });

        
    newFile();
    onresize();
};
    
onresize = function() {
    var container = document.getElementById('editor');
    var containerWidth = container.offsetWidth;
    var containerHeight = container.offsetHeight;
    
    var scrollerElement = editor.getScrollerElement();
    scrollerElement.style.width = containerWidth + 'px';
    scrollerElement.style.height = containerHeight + 'px';
    
    editor.refresh();
}