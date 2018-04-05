# babel-plugin-transform-helper

Babel transforms some awesome ES6 features to ES5 with extra code, such as Class,JSX. This plugin makes all generated extra codes to one module which significantly reduces the bundle code size.

## Install
	
	npm install babel-plugin-transform-helper --save-dev
	
## Usage
### .babelrc
	
	{
		...
		"plugins":["babel-plugin-transform-helper"]
	}
	
### code

	babel.transform(code,{
		...
		plugins:["babel-plugin-transform-helper"]
	})
	
## Options
You can specify the helper bundle file path by `helperFilename` property.

	babel.transform(code,{
		...
		plugins:[
			["babel-plugin-transform-helper",{
					helperFilename:'tempHelper.js'
				}
			]
		]
	})
	
## How it work
This plugin write all generated helper code to one module and the original codes require the module instead of calling from local.Let's support we have two class file.

````javascript
	//Point.js
	export default class Point extends Array{
		constructor(x,y){
			super();
			this.push(x,y);
		}
		get x(){
    		return this[0]
    	}
    	get y(){
    		return this[1]
    	}
    }
    //Rect.js
    import Point from './Point';
    export default class Rect extends Array{
    	constructor(x,y,w,h){
    		super();
    		this.push(x,y,w,h);
		}
		get loc(){
    		return new Point(this[0],this[1])
		}
	}
````

When transfers ES6 class,import,typeof ... to ES5, babel add helper code in each original file, the `Point.js` will be transfered to

````javascript
	var _createClass =//..some code

	function _classCallCheck(instance, Constructor){//..some code}
	function _possibleConstructorReturn(self, call){//..some code}

	function _inherits(subClass, superClass){//..some code}

	var Point = function (_Array) {
		_inherits(Point, _Array);
		function Point(x, y) {	
			_classCallCheck(this, Point);
	 		var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(Point).call(this));
			_this.push(x, y);
			return _this;
		}
		_createClass(Point, [{
    		key: "x",
    		get: function get() {
      			return this[0];
    		}//...some code
    	}]);
		return Point;
	}(Array)
````

If every file adds these same code the size of bundle file used in browser can be extremely larger than the original source file. The helper codes are the same in every file,so we can group them in a moudle and require the module instead of call it from local, which make the `Point.js` like below.

````js	
	var Point = function (_Array) {
		require("../../tempHelper.js").inherits(Point, _Array);
		function Point(x, y) {
    		require("../../tempHelper.js").classCallCheck(this, Point);
			var _this = require("../../tempHelper.js").possibleConstructorReturn(this, Object.getPrototypeOf(Point).call(this));
	 		_this.push(x, y);
    		return _this;
		}	
		require("../../tempHelper.js").createClass(Point, [{
    		key: "x",
    		get: function get() {
      			return this[0];
    		}//...somecode
		}]);
		return Point;
	}(Array);
````	
And generate a file `tempHelper.js`
````js
	exports.inherits=//..somecode
	exports.createClass=//..somecode
	....
````	
When `Point.js` and `Rect.js` bundled together, they require the same module and the code size reduced.The temp module file will be write to the working directory and bundled automatically.

