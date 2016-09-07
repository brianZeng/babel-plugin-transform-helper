import * as babelHelpers from "babel-helpers";
import * as path from 'path';
import * as fs from 'fs';
import {printAst, cheapTraverse} from './register';
let babel, helperDefineTemplate,
  helperImportTemplate,
  helperRequireTemplate,
  StringLiteral,
  Identifier,
  File,
  Program;
let DEF_HELPER_FILE_PATH = '.temp_bundle_helpers.js';

export class HelperRemap {
  constructor(babelCore){
    this.usedHelpers = [];
    this._definedHelpers = {};
    this._extractRules = [];
    registerBabel(babelCore);
  }

  get shouldRewriteTempFile(){
    return !this._helperFileExist && this._invalidTempFile;
  }

  get helperAbsPath(){
    let filename = this.helperFilename;
    if (!path.isAbsolute(filename)) {
      return path.join(process.cwd(), filename);
    }
    return filename;
  }


  set helperFilename(helperFilename){
    let last = this._helperFilename, current = helperFilename || DEF_HELPER_FILE_PATH;
    if (last !== current) {
      this._helperFilename = this.checkHelperPath(current)
    }
  }

  get helperFilename(){
    return this._helperFilename;
  }

  isHelperFile(sourcePath){
    return sourcePath == this.helperAbsPath && this._helperFileExist
  }

  removeTempFile(){
    let absPath = path.join(process.cwd(), DEF_HELPER_FILE_PATH);
    try {
      fs.unlinkSync(absPath);
      return true;
    }
    catch (ex) {
      return false;
    }
  }

  useHelper(name, relativePath){
    let { usedHelpers }=this;
    if (usedHelpers.indexOf(name) == -1) {
      usedHelpers.push(name);
      this.removeTempFile();
      this._invalidTempFile = true;
    }
    return helperRequireTemplate({
      HELPER_NAMESPACE: StringLiteral(relativePath),
      METHOD_NAME: Identifier(name)
    }).expression;
  }

  getUsedMethods({exclude}={}){
    if (!Array.isArray(exclude)) {
      exclude = [];
    }
    let ret = [];
    for (let name of this.usedHelpers) {
      if (exclude.indexOf(name) == -1) {
        let METHOD = this._definedHelpers[name] || babelHelpers.get(name);
        ret.push(helperDefineTemplate({
          METHOD_NAME: Identifier(name),
          METHOD
        }))
      }
    }
    return ret;
  }

  defineHelper(name, node){
    if (babel.types.isNode(node)) {
      this._definedHelpers[name] = node;
    }
    else {
      throw Error('not a Node');
    }
  }
  checkHelperPath(filename){
    if (!filename) {
      throw Error('filename empty');
    }
    if (path.extname(filename) !== '.js') {
      filename = filename + '.js';
    }
    try {
      fs.statSync(filename);
      this._helperFileExist = true;
    }
    catch (ex) {
      this._helperFileExist = false;
    }
    return filename;
  }

  helperFactory(relativePath){
    let self = this;
    return (name)=>self.useHelper(name, relativePath)
  }

  writeHelperFile(path){
    fs.writeFileSync(path, printAst(this.getUsedMethods()))
  }

  shouldExtract(name){
    for (let rule of this._extractRules) {
      if (rule(name)) {
        return true;
      }
    }
    return false;
  }

  addExtractRule(text){
    let rule = parseTestFunction(text);
    if (rule) {
      this._extractRules.push(rule);
      return rule;
    }
  }
}

let babelRegistered;
export function registerBabel(babelCore){
  if (!babelRegistered) {
    babel = babelCore;
    let {template,types}=babel;
    StringLiteral = types.StringLiteral;
    Identifier = types.Identifier;
    File = babel.File;
    Program = types.Program;
    helperDefineTemplate = template(`exports.METHOD_NAME=METHOD`);
    helperRequireTemplate = template(`require(HELPER_NAMESPACE).METHOD_NAME`);
    helperImportTemplate = template(`require(HELPER_NAMESPACE)`);
  }
  babelRegistered = true;
}
export function getRelativePath(from, to){
  let relativePath = path.relative(path.dirname(from), to);
  if (!/^\.+[\/\\]/.test(relativePath)) {
    relativePath = '.' + path.sep + relativePath;
  }
  return relativePath;
}
export function traverseExportNames(topNode){
  let names = [];
  cheapTraverse(topNode, function (node){
    let left;
    if (node.type == 'AssignmentExpression' && (left = node.left).type == 'MemberExpression') {
      let {object,property}=left;
      if (object.type == 'Identifier' && object.name == 'exports' && property.type == 'Identifier') {
        if (names.indexOf(property.name == -1)) {
          names.push(property.name);
        }
        return false;
      }
    }
  });
  return names;
}
function parseTestFunction(text){
  switch (typeof text) {
    case 'function':
      return (name)=>text(name);
    case 'string':
      if (/^\/.+\/$/.test(text)) {
        let regExp = new RegExp(text.substring(1, text.length - 1));
        return name=>regExp.test(name)
      }
      return name=>name === text;
    default:
      if (text instanceof RegExp) {
        return name=>text.test(name);
      }
      return;
  }
}