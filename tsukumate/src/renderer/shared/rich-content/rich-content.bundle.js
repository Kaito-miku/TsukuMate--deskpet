(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // node_modules/dompurify/dist/purify.es.mjs
  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e, n, i, u, a = [], f = true, o = false;
      try {
        if (i = (t = t.call(r)).next, 0 === l) ;
        else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
      } catch (r2) {
        o = true, n = r2;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }
  function unapply(func) {
    return function(thisArg) {
      if (thisArg instanceof RegExp) {
        thisArg.lastIndex = 0;
      }
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      return apply(func, thisArg, args);
    };
  }
  function unconstruct(Func) {
    return function() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      return construct(Func, args);
    };
  }
  function addToSet(set, array) {
    let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
    if (setPrototypeOf) {
      setPrototypeOf(set, null);
    }
    if (!arrayIsArray(array)) {
      return set;
    }
    let l = array.length;
    while (l--) {
      let element = array[l];
      if (typeof element === "string") {
        const lcElement = transformCaseFunc(element);
        if (lcElement !== element) {
          if (!isFrozen(array)) {
            array[l] = lcElement;
          }
          element = lcElement;
        }
      }
      set[element] = true;
    }
    return set;
  }
  function cleanArray(array) {
    for (let index = 0; index < array.length; index++) {
      const isPropertyExist = objectHasOwnProperty(array, index);
      if (!isPropertyExist) {
        array[index] = null;
      }
    }
    return array;
  }
  function clone(object) {
    const newObject = create(null);
    for (const _ref2 of entries(object)) {
      var _ref3 = _slicedToArray(_ref2, 2);
      const property = _ref3[0];
      const value = _ref3[1];
      const isPropertyExist = objectHasOwnProperty(object, property);
      if (isPropertyExist) {
        if (arrayIsArray(value)) {
          newObject[property] = cleanArray(value);
        } else if (value && typeof value === "object" && value.constructor === Object) {
          newObject[property] = clone(value);
        } else {
          newObject[property] = value;
        }
      }
    }
    return newObject;
  }
  function stringifyValue(value) {
    switch (typeof value) {
      case "string": {
        return value;
      }
      case "number": {
        return numberToString(value);
      }
      case "boolean": {
        return booleanToString(value);
      }
      case "bigint": {
        return bigintToString ? bigintToString(value) : "0";
      }
      case "symbol": {
        return symbolToString ? symbolToString(value) : "Symbol()";
      }
      case "undefined": {
        return objectToString(value);
      }
      case "function":
      case "object": {
        if (value === null) {
          return objectToString(value);
        }
        const valueAsRecord = value;
        const valueToString = lookupGetter(valueAsRecord, "toString");
        if (typeof valueToString === "function") {
          const stringified = valueToString(valueAsRecord);
          return typeof stringified === "string" ? stringified : objectToString(stringified);
        }
        return objectToString(value);
      }
      default: {
        return objectToString(value);
      }
    }
  }
  function lookupGetter(object, prop) {
    while (object !== null) {
      const desc = getOwnPropertyDescriptor(object, prop);
      if (desc) {
        if (desc.get) {
          return unapply(desc.get);
        }
        if (typeof desc.value === "function") {
          return unapply(desc.value);
        }
      }
      object = getPrototypeOf(object);
    }
    function fallbackValue() {
      return null;
    }
    return fallbackValue;
  }
  function isRegex(value) {
    try {
      regExpTest(value, "");
      return true;
    } catch (_unused) {
      return false;
    }
  }
  function createDOMPurify() {
    let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
    const DOMPurify = (root) => createDOMPurify(root);
    DOMPurify.version = "3.4.12";
    DOMPurify.removed = [];
    if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
      DOMPurify.isSupported = false;
      return DOMPurify;
    }
    let document2 = window2.document;
    const originalDocument = document2;
    const currentScript = originalDocument.currentScript;
    window2.DocumentFragment;
    const HTMLTemplateElement = window2.HTMLTemplateElement, Node = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter, _window$NamedNodeMap = window2.NamedNodeMap;
    _window$NamedNodeMap === void 0 ? window2.NamedNodeMap || window2.MozNamedAttrMap : _window$NamedNodeMap;
    window2.HTMLFormElement;
    const DOMParser = window2.DOMParser, trustedTypes = window2.trustedTypes;
    const ElementPrototype = Element.prototype;
    const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
    const remove = lookupGetter(ElementPrototype, "remove");
    const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
    const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
    const getParentNode = lookupGetter(ElementPrototype, "parentNode");
    const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
    const getAttributes = lookupGetter(ElementPrototype, "attributes");
    const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
    const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
    if (typeof HTMLTemplateElement === "function") {
      const template = document2.createElement("template");
      if (template.content && template.content.ownerDocument) {
        document2 = template.content.ownerDocument;
      }
    }
    let trustedTypesPolicy;
    let emptyHTML = "";
    let defaultTrustedTypesPolicy;
    let defaultTrustedTypesPolicyResolved = false;
    let IN_TRUSTED_TYPES_POLICY = 0;
    const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
      if (IN_TRUSTED_TYPES_POLICY > 0) {
        throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
      }
    };
    const _createTrustedHTML = function _createTrustedHTML2(html3) {
      _assertNotInTrustedTypesPolicy();
      IN_TRUSTED_TYPES_POLICY++;
      try {
        return trustedTypesPolicy.createHTML(html3);
      } finally {
        IN_TRUSTED_TYPES_POLICY--;
      }
    };
    const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
      _assertNotInTrustedTypesPolicy();
      IN_TRUSTED_TYPES_POLICY++;
      try {
        return trustedTypesPolicy.createScriptURL(scriptUrl);
      } finally {
        IN_TRUSTED_TYPES_POLICY--;
      }
    };
    const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
      if (!defaultTrustedTypesPolicyResolved) {
        defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
        defaultTrustedTypesPolicyResolved = true;
      }
      return defaultTrustedTypesPolicy;
    };
    const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
    const importNode = originalDocument.importNode;
    let hooks = _createHooksMap();
    DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
    const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
    let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
    let ALLOWED_TAGS = null;
    const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
    let ALLOWED_ATTR = null;
    const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
    let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
      tagNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      allowCustomizedBuiltInElements: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: false
      }
    }));
    let FORBID_TAGS = null;
    let FORBID_ATTR = null;
    const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
      tagCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      }
    }));
    let ALLOW_ARIA_ATTR = true;
    let ALLOW_DATA_ATTR = true;
    let ALLOW_UNKNOWN_PROTOCOLS = false;
    let ALLOW_SELF_CLOSE_IN_ATTR = true;
    let SAFE_FOR_TEMPLATES = false;
    let SAFE_FOR_XML = true;
    let WHOLE_DOCUMENT = false;
    let SET_CONFIG = false;
    let SET_CONFIG_ALLOWED_TAGS = null;
    let SET_CONFIG_ALLOWED_ATTR = null;
    let FORCE_BODY = false;
    let RETURN_DOM = false;
    let RETURN_DOM_FRAGMENT = false;
    let RETURN_TRUSTED_TYPE = false;
    let SANITIZE_DOM = true;
    let SANITIZE_NAMED_PROPS = false;
    const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
    let KEEP_CONTENT = true;
    let IN_PLACE = false;
    let USE_PROFILES = {};
    let FORBID_CONTENTS = null;
    const DEFAULT_FORBID_CONTENTS = addToSet({}, [
      "annotation-xml",
      "audio",
      "colgroup",
      "desc",
      "foreignobject",
      "head",
      "iframe",
      "math",
      "mi",
      "mn",
      "mo",
      "ms",
      "mtext",
      "noembed",
      "noframes",
      "noscript",
      "plaintext",
      "script",
      // <selectedcontent> mirrors the selected <option>'s subtree, cloned by
      // the UA (customizable <select>) — including any on* handlers — and the
      // engine re-mirrors synchronously whenever a removal changes which
      // option/selectedcontent is current, even inside DOMPurify's inert
      // DOMParser document. Hoisting its children on removal re-inserts a fresh
      // mirror target ahead of the walk, which the engine refills, looping
      // forever (DoS) and amplifying output. Dropping its content on removal
      // (rather than hoisting) breaks that cascade; the content is a duplicate
      // of the option, which is sanitized on its own. See campaign-3 F1/F6.
      "selectedcontent",
      "style",
      "svg",
      "template",
      "thead",
      "title",
      "video",
      "xmp"
    ]);
    let DATA_URI_TAGS = null;
    const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
    let URI_SAFE_ATTRIBUTES = null;
    const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
    const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    let NAMESPACE = HTML_NAMESPACE;
    let IS_EMPTY_INPUT = false;
    let ALLOWED_NAMESPACES = null;
    const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
    const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze(["mi", "mo", "mn", "ms", "mtext"]);
    let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
    const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
    let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
    const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
    let PARSER_MEDIA_TYPE = null;
    const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
    const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
    let transformCaseFunc = null;
    let CONFIG = null;
    const formElement = document2.createElement("form");
    const isRegexOrFunction = function isRegexOrFunction2(testValue) {
      return testValue instanceof RegExp || testValue instanceof Function;
    };
    const _parseConfig = function _parseConfig2() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      if (CONFIG && CONFIG === cfg) {
        return;
      }
      if (!cfg || typeof cfg !== "object") {
        cfg = {};
      }
      cfg = clone(cfg);
      PARSER_MEDIA_TYPE = // eslint-disable-next-line unicorn/prefer-includes
      SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
      transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
      ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, {
        transform: transformCaseFunc
      });
      ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, {
        transform: transformCaseFunc
      });
      ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, {
        transform: stringToString
      });
      URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
        transform: transformCaseFunc,
        base: DEFAULT_URI_SAFE_ATTRIBUTES
      });
      DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
        transform: transformCaseFunc,
        base: DEFAULT_DATA_URI_TAGS
      });
      FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, {
        transform: transformCaseFunc
      });
      FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), {
        transform: transformCaseFunc
      });
      FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), {
        transform: transformCaseFunc
      });
      USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
      ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
      ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
      ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
      ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
      SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
      SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
      WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
      RETURN_DOM = cfg.RETURN_DOM || false;
      RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
      RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
      FORCE_BODY = cfg.FORCE_BODY || false;
      SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
      SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
      KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
      IN_PLACE = cfg.IN_PLACE || false;
      IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
      NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
      MATHML_TEXT_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "MATHML_TEXT_INTEGRATION_POINTS") && cfg.MATHML_TEXT_INTEGRATION_POINTS && typeof cfg.MATHML_TEXT_INTEGRATION_POINTS === "object" ? clone(cfg.MATHML_TEXT_INTEGRATION_POINTS) : addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
      HTML_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "HTML_INTEGRATION_POINTS") && cfg.HTML_INTEGRATION_POINTS && typeof cfg.HTML_INTEGRATION_POINTS === "object" ? clone(cfg.HTML_INTEGRATION_POINTS) : addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
      const customElementHandling = objectHasOwnProperty(cfg, "CUSTOM_ELEMENT_HANDLING") && cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING === "object" ? clone(cfg.CUSTOM_ELEMENT_HANDLING) : create(null);
      CUSTOM_ELEMENT_HANDLING = create(null);
      if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
      }
      if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
      }
      if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") {
        CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
      }
      seal(CUSTOM_ELEMENT_HANDLING);
      if (SAFE_FOR_TEMPLATES) {
        ALLOW_DATA_ATTR = false;
      }
      if (RETURN_DOM_FRAGMENT) {
        RETURN_DOM = true;
      }
      if (USE_PROFILES) {
        ALLOWED_TAGS = addToSet({}, text);
        ALLOWED_ATTR = create(null);
        if (USE_PROFILES.html === true) {
          addToSet(ALLOWED_TAGS, html$1);
          addToSet(ALLOWED_ATTR, html);
        }
        if (USE_PROFILES.svg === true) {
          addToSet(ALLOWED_TAGS, svg$1);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.svgFilters === true) {
          addToSet(ALLOWED_TAGS, svgFilters);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.mathMl === true) {
          addToSet(ALLOWED_TAGS, mathMl$1);
          addToSet(ALLOWED_ATTR, mathMl);
          addToSet(ALLOWED_ATTR, xml);
        }
      }
      EXTRA_ELEMENT_HANDLING.tagCheck = null;
      EXTRA_ELEMENT_HANDLING.attributeCheck = null;
      if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
        if (typeof cfg.ADD_TAGS === "function") {
          EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
        } else if (arrayIsArray(cfg.ADD_TAGS)) {
          if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
            ALLOWED_TAGS = clone(ALLOWED_TAGS);
          }
          addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
        if (typeof cfg.ADD_ATTR === "function") {
          EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
        } else if (arrayIsArray(cfg.ADD_ATTR)) {
          if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
            ALLOWED_ATTR = clone(ALLOWED_ATTR);
          }
          addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR)) {
        addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
      }
      if (objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
      }
      if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
      }
      if (KEEP_CONTENT) {
        ALLOWED_TAGS["#text"] = true;
      }
      if (WHOLE_DOCUMENT) {
        addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
      }
      if (ALLOWED_TAGS.table) {
        addToSet(ALLOWED_TAGS, ["tbody"]);
        delete FORBID_TAGS.tbody;
      }
      if (cfg.TRUSTED_TYPES_POLICY) {
        if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
        }
        if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
        }
        const previousTrustedTypesPolicy = trustedTypesPolicy;
        trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
        try {
          emptyHTML = _createTrustedHTML("");
        } catch (error) {
          trustedTypesPolicy = previousTrustedTypesPolicy;
          throw error;
        }
      } else if (cfg.TRUSTED_TYPES_POLICY === null) {
        trustedTypesPolicy = void 0;
        emptyHTML = "";
      } else {
        if (trustedTypesPolicy === void 0) {
          trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
        }
        if (trustedTypesPolicy && typeof emptyHTML === "string") {
          emptyHTML = _createTrustedHTML("");
        }
      }
      if (freeze) {
        freeze(cfg);
      }
      CONFIG = cfg;
    };
    const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
    const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
    const _checkSvgNamespace = function _checkSvgNamespace2(tagName, parent, parentTagName) {
      if (parent.namespaceURI === HTML_NAMESPACE) {
        return tagName === "svg";
      }
      if (parent.namespaceURI === MATHML_NAMESPACE) {
        return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
      }
      return Boolean(ALL_SVG_TAGS[tagName]);
    };
    const _checkMathMlNamespace = function _checkMathMlNamespace2(tagName, parent, parentTagName) {
      if (parent.namespaceURI === HTML_NAMESPACE) {
        return tagName === "math";
      }
      if (parent.namespaceURI === SVG_NAMESPACE) {
        return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
      }
      return Boolean(ALL_MATHML_TAGS[tagName]);
    };
    const _checkHtmlNamespace = function _checkHtmlNamespace2(tagName, parent, parentTagName) {
      if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
        return false;
      }
      if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
        return false;
      }
      return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
    };
    const _checkValidNamespace = function _checkValidNamespace2(element) {
      let parent = getParentNode(element);
      if (!parent || !parent.tagName) {
        parent = {
          namespaceURI: NAMESPACE,
          tagName: "template"
        };
      }
      const tagName = stringToLowerCase(element.tagName);
      const parentTagName = stringToLowerCase(parent.tagName);
      if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
        return false;
      }
      if (element.namespaceURI === SVG_NAMESPACE) {
        return _checkSvgNamespace(tagName, parent, parentTagName);
      }
      if (element.namespaceURI === MATHML_NAMESPACE) {
        return _checkMathMlNamespace(tagName, parent, parentTagName);
      }
      if (element.namespaceURI === HTML_NAMESPACE) {
        return _checkHtmlNamespace(tagName, parent, parentTagName);
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
        return true;
      }
      return false;
    };
    const _forceRemove = function _forceRemove2(node) {
      arrayPush(DOMPurify.removed, {
        element: node
      });
      try {
        getParentNode(node).removeChild(node);
      } catch (_) {
        remove(node);
        if (!getParentNode(node)) {
          throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
        }
      }
    };
    const _neutralizeRoot = function _neutralizeRoot2(root) {
      _neutralizeSubtree(root);
      const childNodes = getChildNodes(root);
      if (childNodes) {
        const snapshot = [];
        arrayForEach(childNodes, (child) => {
          arrayPush(snapshot, child);
        });
        arrayForEach(snapshot, (child) => {
          try {
            remove(child);
          } catch (_) {
          }
        });
      }
      const attributes = getAttributes(root);
      if (attributes) {
        for (let i = attributes.length - 1; i >= 0; --i) {
          const attribute = attributes[i];
          const name = attribute && attribute.name;
          if (typeof name === "string") {
            try {
              root.removeAttribute(name);
            } catch (_) {
            }
          }
        }
      }
    };
    const _removeAttribute = function _removeAttribute2(name, element) {
      try {
        arrayPush(DOMPurify.removed, {
          attribute: element.getAttributeNode(name),
          from: element
        });
      } catch (_) {
        arrayPush(DOMPurify.removed, {
          attribute: null,
          from: element
        });
      }
      element.removeAttribute(name);
      if (name === "is") {
        if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
          try {
            _forceRemove(element);
          } catch (_) {
          }
        } else {
          try {
            element.setAttribute(name, "");
          } catch (_) {
          }
        }
      }
    };
    const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
      const attributes = getAttributes(element);
      if (!attributes) {
        return;
      }
      for (let i = attributes.length - 1; i >= 0; --i) {
        const attribute = attributes[i];
        const name = attribute && attribute.name;
        if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) {
          continue;
        }
        try {
          element.removeAttribute(name);
        } catch (_) {
        }
      }
    };
    const _neutralizeSubtree = function _neutralizeSubtree2(root) {
      const stack = [root];
      while (stack.length > 0) {
        const node = stack.pop();
        const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
        if (nodeType === NODE_TYPE.element) {
          _stripDisallowedAttributes(node);
        }
        const childNodes = getChildNodes(node);
        if (childNodes) {
          for (let i = childNodes.length - 1; i >= 0; --i) {
            stack.push(childNodes[i]);
          }
        }
      }
    };
    const _neutralizePatchLinkage = function _neutralizePatchLinkage2(root) {
      if (!SAFE_FOR_XML) {
        return;
      }
      const stack = [root];
      while (stack.length > 0) {
        const node = stack.pop();
        const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
        if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
          try {
            remove(node);
          } catch (_) {
          }
          continue;
        }
        if (nodeType === NODE_TYPE.element) {
          const element = node;
          const lcTag = transformCaseFunc(getNodeName ? getNodeName(node) : node.nodeName);
          try {
            if (element.hasAttribute && element.hasAttribute("patchsrc")) {
              element.removeAttribute("patchsrc");
            }
            if (element.hasAttribute && element.hasAttribute("for") && lcTag !== "label" && lcTag !== "output") {
              element.removeAttribute("for");
            }
          } catch (_) {
          }
        }
        const childNodes = getChildNodes(node);
        if (childNodes) {
          for (let i = childNodes.length - 1; i >= 0; --i) {
            stack.push(childNodes[i]);
          }
        }
      }
    };
    const _initDocument = function _initDocument2(dirty) {
      let doc2 = null;
      let leadingWhitespace = null;
      if (FORCE_BODY) {
        dirty = "<remove></remove>" + dirty;
      } else {
        const matches = stringMatch(dirty, /^[\r\n\t ]+/);
        leadingWhitespace = matches && matches[0];
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
        dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
      }
      const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
      if (NAMESPACE === HTML_NAMESPACE) {
        try {
          doc2 = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
        } catch (_) {
        }
      }
      if (!doc2 || !doc2.documentElement) {
        doc2 = implementation.createDocument(NAMESPACE, "template", null);
        try {
          doc2.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
        } catch (_) {
        }
      }
      const body = doc2.body || doc2.documentElement;
      if (dirty && leadingWhitespace) {
        body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
      }
      if (NAMESPACE === HTML_NAMESPACE) {
        return getElementsByTagName.call(doc2, WHOLE_DOCUMENT ? "html" : "body")[0];
      }
      return WHOLE_DOCUMENT ? doc2.documentElement : body;
    };
    const _createNodeIterator = function _createNodeIterator2(root) {
      return createNodeIterator.call(
        root.ownerDocument || root,
        root,
        // eslint-disable-next-line no-bitwise
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION,
        null
      );
    };
    const _stripTemplateExpressions = function _stripTemplateExpressions2(value) {
      value = stringReplace(value, MUSTACHE_EXPR$1, " ");
      value = stringReplace(value, ERB_EXPR$1, " ");
      value = stringReplace(value, TMPLIT_EXPR$1, " ");
      return value;
    };
    const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
      var _node$querySelectorAl;
      node.normalize();
      const walker = createNodeIterator.call(
        node.ownerDocument || node,
        node,
        // eslint-disable-next-line no-bitwise
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION,
        null
      );
      let currentNode = walker.nextNode();
      while (currentNode) {
        currentNode.data = _stripTemplateExpressions(currentNode.data);
        currentNode = walker.nextNode();
      }
      const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
      if (templates) {
        arrayForEach(templates, (tmpl) => {
          if (_isDocumentFragment(tmpl.content)) {
            _scrubTemplateExpressions2(tmpl.content);
          }
        });
      }
    };
    const _isClobbered = function _isClobbered2(element) {
      const realTagName = getNodeName ? getNodeName(element) : null;
      if (typeof realTagName !== "string") {
        return false;
      }
      if (transformCaseFunc(realTagName) !== "form") {
        return false;
      }
      return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || // Realm-safe NamedNodeMap detection: equality against the cached
      // prototype getter. Clobbered .attributes (e.g. <input name="attributes">)
      // makes the direct read diverge from the cached read; a clean form
      // (same-realm OR foreign-realm) has both reads pointing at the same
      // canonical NamedNodeMap.
      element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || // NodeType clobbering probe. Cached Node.prototype.nodeType getter
      // returns the integer 1 for any Element regardless of realm; direct
      // read on a clobbered form (e.g. <input name="nodeType">) returns
      // the named child element. Cheap addition — nodeType is read from
      // an internal slot, no serialization cost — and removes a residual
      // clobbering surface used by several mXSS / PI / comment branches
      // in _sanitizeElements that compare currentNode.nodeType directly.
      element.nodeType !== getNodeType(element) || // HTMLFormElement has [LegacyOverrideBuiltIns]: a descendant named
      // "childNodes" shadows the prototype getter. Direct reads of
      // form.childNodes from a clobbered form return the named child
      // instead of the real NodeList, so any walk that reads it directly
      // skips the form's real children. Compare the direct read to the
      // cached Node.prototype getter — when the form's named-property
      // getter intercepts the read, the two values differ and we flag
      // the form. This catches every clobbering child type (input,
      // select, etc.) regardless of whether the named child happens to
      // carry a numeric .length, which a typeof-based probe would miss
      // (e.g. HTMLSelectElement.length is a defined unsigned-long).
      element.childNodes !== getChildNodes(element);
    };
    const _isDocumentFragment = function _isDocumentFragment2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) {
        return false;
      }
      try {
        return getNodeType(value) === NODE_TYPE.documentFragment;
      } catch (_) {
        return false;
      }
    };
    const _isNode = function _isNode2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) {
        return false;
      }
      try {
        return typeof getNodeType(value) === "number";
      } catch (_) {
        return false;
      }
    };
    function _executeHooks(hooks2, currentNode, data) {
      if (hooks2.length === 0) {
        return;
      }
      arrayForEach(hooks2, (hook) => {
        hook.call(DOMPurify, currentNode, data, CONFIG);
      });
    }
    const _isUnsafeNode = function _isUnsafeNode2(currentNode, tagName) {
      if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) {
        return true;
      }
      if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && tagName === "style" && _isNode(currentNode.firstElementChild)) {
        return true;
      }
      if (currentNode.nodeType === NODE_TYPE.processingInstruction) {
        return true;
      }
      if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) {
        return true;
      }
      return false;
    };
    const _sanitizeDisallowedNode = function _sanitizeDisallowedNode2(currentNode, tagName) {
      if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
        if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
          return false;
        }
        if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
          return false;
        }
      }
      if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
        const parentNode = getParentNode(currentNode);
        const childNodes = getChildNodes(currentNode);
        if (childNodes && parentNode) {
          const childCount = childNodes.length;
          for (let i = childCount - 1; i >= 0; --i) {
            const hoisted = IN_PLACE ? childNodes[i] : cloneNode(childNodes[i], true);
            parentNode.insertBefore(hoisted, getNextSibling(currentNode));
          }
        }
      }
      _forceRemove(currentNode);
      return true;
    };
    const _sanitizeElements = function _sanitizeElements2(currentNode, root) {
      _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
      if (currentNode !== root && getParentNode(currentNode) === null) {
        return true;
      }
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      const tagName = transformCaseFunc(getNodeName ? getNodeName(currentNode) : currentNode.nodeName);
      _executeHooks(hooks.uponSanitizeElement, currentNode, {
        tagName,
        allowedTags: ALLOWED_TAGS
      });
      if (currentNode !== root && getParentNode(currentNode) === null) {
        return true;
      }
      if (_isUnsafeNode(currentNode, tagName)) {
        _forceRemove(currentNode);
        return true;
      }
      if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
        const removed = _sanitizeDisallowedNode(currentNode, tagName);
        if (removed === false) {
          _executeHooks(hooks.afterSanitizeElements, currentNode, null);
        }
        return removed;
      }
      const nt = getNodeType ? getNodeType(currentNode) : currentNode.nodeType;
      if (nt === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
        const content = _stripTemplateExpressions(currentNode.textContent);
        if (currentNode.textContent !== content) {
          arrayPush(DOMPurify.removed, {
            element: currentNode.cloneNode()
          });
          currentNode.textContent = content;
        }
      }
      _executeHooks(hooks.afterSanitizeElements, currentNode, null);
      return false;
    };
    const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
      if (FORBID_ATTR[lcName]) {
        return false;
      }
      if (SAFE_FOR_XML && lcName === "patchsrc") {
        return false;
      }
      if (SAFE_FOR_XML && lcName === "for" && lcTag !== "label" && lcTag !== "output") {
        return false;
      }
      if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
        return false;
      }
      const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
      if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) ;
      else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) ;
      else if (!nameIsPermitted) {
        if (
          // First condition does a very basic check if a) it's basically a valid custom element tagname AND
          // b) if the tagName passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
          // and c) if the attribute name passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.attributeNameCheck
          _isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) || // Alternative, second condition checks if it's an `is`-attribute, AND
          // the value passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
          lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value))
        ) ;
        else {
          return false;
        }
      } else if (URI_SAFE_ATTRIBUTES[lcName]) ;
      else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
      else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) ;
      else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
      else if (value) {
        return false;
      } else ;
      return true;
    };
    const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, ["annotation-xml", "color-profile", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "missing-glyph"]);
    const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
      return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
    };
    const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute2(lcTag, lcName, namespaceURI, value) {
      if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) {
        switch (trustedTypes.getAttributeType(lcTag, lcName)) {
          case "TrustedHTML": {
            return _createTrustedHTML(value);
          }
          case "TrustedScriptURL": {
            return _createTrustedScriptURL(value);
          }
        }
      }
      return value;
    };
    const _setAttributeValue = function _setAttributeValue2(currentNode, name, namespaceURI, value) {
      try {
        if (namespaceURI) {
          currentNode.setAttributeNS(namespaceURI, name, value);
        } else {
          currentNode.setAttribute(name, value);
        }
        if (_isClobbered(currentNode)) {
          _forceRemove(currentNode);
        } else {
          arrayPop(DOMPurify.removed);
        }
      } catch (_) {
        _removeAttribute(name, currentNode);
      }
    };
    const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
      _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
      const attributes = currentNode.attributes;
      if (!attributes || _isClobbered(currentNode)) {
        return;
      }
      const hookEvent = {
        attrName: "",
        attrValue: "",
        keepAttr: true,
        allowedAttributes: ALLOWED_ATTR,
        forceKeepAttr: void 0
      };
      let l = attributes.length;
      const lcTag = transformCaseFunc(currentNode.nodeName);
      while (l--) {
        const attr = attributes[l];
        const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
        const lcName = transformCaseFunc(name);
        const initValue = attrValue;
        let value = name === "value" ? initValue : stringTrim(initValue);
        hookEvent.attrName = lcName;
        hookEvent.attrValue = value;
        hookEvent.keepAttr = true;
        hookEvent.forceKeepAttr = void 0;
        _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
        value = hookEvent.attrValue;
        if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
          _removeAttribute(name, currentNode);
          value = SANITIZE_NAMED_PROPS_PREFIX + value;
        }
        if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (lcName === "attributename" && stringMatch(value, "href")) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (hookEvent.forceKeepAttr) {
          continue;
        }
        if (!hookEvent.keepAttr) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (SAFE_FOR_TEMPLATES) {
          value = _stripTemplateExpressions(value);
        }
        if (!_isValidAttribute(lcTag, lcName, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
        if (value !== initValue) {
          _setAttributeValue(currentNode, name, namespaceURI, value);
        }
      }
      _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
    };
    const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
      let shadowNode = null;
      const shadowIterator = _createNodeIterator(fragment);
      _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
      while (shadowNode = shadowIterator.nextNode()) {
        _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
        _sanitizeElements(shadowNode, fragment);
        _sanitizeAttributes(shadowNode);
        if (_isDocumentFragment(shadowNode.content)) {
          _sanitizeShadowDOM2(shadowNode.content);
        }
        const shadowNodeType = getNodeType ? getNodeType(shadowNode) : shadowNode.nodeType;
        if (shadowNodeType === NODE_TYPE.element) {
          const innerSr = getShadowRoot(shadowNode);
          if (_isDocumentFragment(innerSr)) {
            _sanitizeAttachedShadowRoots(innerSr);
            _sanitizeShadowDOM2(innerSr);
          }
        }
      }
      _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
    };
    const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
      const stack = [{
        node: root,
        shadow: null
      }];
      while (stack.length > 0) {
        const item = stack.pop();
        if (item.shadow) {
          _sanitizeShadowDOM2(item.shadow);
          continue;
        }
        const node = item.node;
        const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
        const isElement = nodeType === NODE_TYPE.element;
        const childNodes = getChildNodes(node);
        if (childNodes) {
          for (let i = childNodes.length - 1; i >= 0; --i) {
            stack.push({
              node: childNodes[i],
              shadow: null
            });
          }
        }
        if (isElement) {
          const rootName = getNodeName ? getNodeName(node) : null;
          if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
            const content = node.content;
            if (_isDocumentFragment(content)) {
              stack.push({
                node: content,
                shadow: null
              });
            }
          }
        }
        if (isElement) {
          const sr = getShadowRoot(node);
          if (_isDocumentFragment(sr)) {
            stack.push({
              node: null,
              shadow: sr
            }, {
              node: sr,
              shadow: null
            });
          }
        }
      }
    };
    DOMPurify.sanitize = function(dirty) {
      let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      let body = null;
      let importedNode = null;
      let currentNode = null;
      let returnNode = null;
      IS_EMPTY_INPUT = !dirty;
      if (IS_EMPTY_INPUT) {
        dirty = "<!-->";
      }
      if (typeof dirty !== "string" && !_isNode(dirty)) {
        dirty = stringifyValue(dirty);
        if (typeof dirty !== "string") {
          throw typeErrorCreate("dirty is not a string, aborting");
        }
      }
      if (!DOMPurify.isSupported) {
        return dirty;
      }
      if (SET_CONFIG) {
        ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
        ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
      } else {
        _parseConfig(cfg);
      }
      if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) {
        ALLOWED_TAGS = clone(ALLOWED_TAGS);
      }
      if (hooks.uponSanitizeAttribute.length > 0) {
        ALLOWED_ATTR = clone(ALLOWED_ATTR);
      }
      DOMPurify.removed = [];
      const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
      if (inPlace) {
        _neutralizePatchLinkage(dirty);
        const nn = getNodeName ? getNodeName(dirty) : dirty.nodeName;
        if (typeof nn === "string") {
          const tagName = transformCaseFunc(nn);
          if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
            _neutralizeRoot(dirty);
            throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
          }
        }
        if (_isClobbered(dirty)) {
          _neutralizeRoot(dirty);
          throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
        }
        try {
          _sanitizeAttachedShadowRoots(dirty);
        } catch (error) {
          _neutralizeRoot(dirty);
          throw error;
        }
      } else if (_isNode(dirty)) {
        body = _initDocument("<!---->");
        importedNode = body.ownerDocument.importNode(dirty, true);
        if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
          body = importedNode;
        } else if (importedNode.nodeName === "HTML") {
          body = importedNode;
        } else {
          body.appendChild(importedNode);
        }
        _sanitizeAttachedShadowRoots(importedNode);
      } else {
        if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && // eslint-disable-next-line unicorn/prefer-includes
        dirty.indexOf("<") === -1) {
          return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
        }
        body = _initDocument(dirty);
        if (!body) {
          return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
        }
      }
      if (body && FORCE_BODY) {
        _forceRemove(body.firstChild);
      }
      const walkRoot = inPlace ? dirty : body;
      const nodeIterator = _createNodeIterator(walkRoot);
      try {
        while (currentNode = nodeIterator.nextNode()) {
          _sanitizeElements(currentNode, walkRoot);
          _sanitizeAttributes(currentNode);
          if (_isDocumentFragment(currentNode.content)) {
            _sanitizeShadowDOM2(currentNode.content);
          }
        }
      } catch (error) {
        if (inPlace) {
          _neutralizeRoot(dirty);
          arrayForEach(DOMPurify.removed, (entry) => {
            if (entry.element) {
              _neutralizeSubtree(entry.element);
            }
          });
        }
        throw error;
      }
      if (inPlace) {
        arrayForEach(DOMPurify.removed, (entry) => {
          if (entry.element) {
            _neutralizeSubtree(entry.element);
          }
        });
        if (SAFE_FOR_TEMPLATES) {
          _scrubTemplateExpressions2(dirty);
        }
        return dirty;
      }
      if (RETURN_DOM) {
        if (SAFE_FOR_TEMPLATES) {
          _scrubTemplateExpressions2(body);
        }
        if (RETURN_DOM_FRAGMENT) {
          returnNode = createDocumentFragment.call(body.ownerDocument);
          while (body.firstChild) {
            returnNode.appendChild(body.firstChild);
          }
        } else {
          returnNode = body;
        }
        if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
          returnNode = importNode.call(originalDocument, returnNode, true);
        }
        return returnNode;
      }
      let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
      if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
        serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
      }
      if (SAFE_FOR_TEMPLATES) {
        serializedHTML = _stripTemplateExpressions(serializedHTML);
      }
      return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
    };
    DOMPurify.setConfig = function() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      _parseConfig(cfg);
      SET_CONFIG = true;
      SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
      SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
    };
    DOMPurify.clearConfig = function() {
      CONFIG = null;
      SET_CONFIG = false;
      SET_CONFIG_ALLOWED_TAGS = null;
      SET_CONFIG_ALLOWED_ATTR = null;
      trustedTypesPolicy = defaultTrustedTypesPolicy;
      emptyHTML = "";
    };
    DOMPurify.isValidAttribute = function(tag2, attr, value) {
      if (!CONFIG) {
        _parseConfig({});
      }
      const lcTag = transformCaseFunc(tag2);
      const lcName = transformCaseFunc(attr);
      return _isValidAttribute(lcTag, lcName, value);
    };
    DOMPurify.addHook = function(entryPoint, hookFunction) {
      if (typeof hookFunction !== "function") {
        return;
      }
      if (!objectHasOwnProperty(hooks, entryPoint)) {
        return;
      }
      arrayPush(hooks[entryPoint], hookFunction);
    };
    DOMPurify.removeHook = function(entryPoint, hookFunction) {
      if (!objectHasOwnProperty(hooks, entryPoint)) {
        return void 0;
      }
      if (hookFunction !== void 0) {
        const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
        return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
      }
      return arrayPop(hooks[entryPoint]);
    };
    DOMPurify.removeHooks = function(entryPoint) {
      if (!objectHasOwnProperty(hooks, entryPoint)) {
        return;
      }
      hooks[entryPoint] = [];
    };
    DOMPurify.removeAllHooks = function() {
      hooks = _createHooksMap();
    };
    return DOMPurify;
  }
  var entries, setPrototypeOf, isFrozen, getPrototypeOf, getOwnPropertyDescriptor, freeze, seal, create, _ref, apply, construct, arrayForEach, arrayLastIndexOf, arrayPop, arrayPush, arraySplice, arrayIsArray, stringToLowerCase, stringToString, stringMatch, stringReplace, stringIndexOf, stringTrim, numberToString, booleanToString, bigintToString, symbolToString, objectHasOwnProperty, objectToString, regExpTest, typeErrorCreate, html$1, svg$1, svgFilters, svgDisallowed, mathMl$1, mathMlDisallowed, text, html, svg, mathMl, xml, MUSTACHE_EXPR, ERB_EXPR, TMPLIT_EXPR, DATA_ATTR, ARIA_ATTR, IS_ALLOWED_URI, IS_SCRIPT_OR_DATA, ATTR_WHITESPACE, DOCTYPE_NAME, CUSTOM_ELEMENT, ELEMENT_MARKUP_PROBE, COMMENT_MARKUP_PROBE, FALLBACK_TAG_CLOSE, SELF_CLOSING_TAG, NODE_TYPE, getGlobal, _createTrustedTypesPolicy, _createHooksMap, _resolveSetOption, purify;
  var init_purify_es = __esm({
    "node_modules/dompurify/dist/purify.es.mjs"() {
      entries = Object.entries;
      setPrototypeOf = Object.setPrototypeOf;
      isFrozen = Object.isFrozen;
      getPrototypeOf = Object.getPrototypeOf;
      getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
      freeze = Object.freeze;
      seal = Object.seal;
      create = Object.create;
      _ref = typeof Reflect !== "undefined" && Reflect;
      apply = _ref.apply;
      construct = _ref.construct;
      if (!freeze) {
        freeze = function freeze2(x) {
          return x;
        };
      }
      if (!seal) {
        seal = function seal2(x) {
          return x;
        };
      }
      if (!apply) {
        apply = function apply2(func, thisArg) {
          for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
            args[_key - 2] = arguments[_key];
          }
          return func.apply(thisArg, args);
        };
      }
      if (!construct) {
        construct = function construct2(Func) {
          for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
            args[_key2 - 1] = arguments[_key2];
          }
          return new Func(...args);
        };
      }
      arrayForEach = unapply(Array.prototype.forEach);
      arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
      arrayPop = unapply(Array.prototype.pop);
      arrayPush = unapply(Array.prototype.push);
      arraySplice = unapply(Array.prototype.splice);
      arrayIsArray = Array.isArray;
      stringToLowerCase = unapply(String.prototype.toLowerCase);
      stringToString = unapply(String.prototype.toString);
      stringMatch = unapply(String.prototype.match);
      stringReplace = unapply(String.prototype.replace);
      stringIndexOf = unapply(String.prototype.indexOf);
      stringTrim = unapply(String.prototype.trim);
      numberToString = unapply(Number.prototype.toString);
      booleanToString = unapply(Boolean.prototype.toString);
      bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
      symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
      objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
      objectToString = unapply(Object.prototype.toString);
      regExpTest = unapply(RegExp.prototype.test);
      typeErrorCreate = unconstruct(TypeError);
      html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
      svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
      svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
      svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
      mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
      mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
      text = freeze(["#text"]);
      html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "command", "commandfor", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns"]);
      svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dominant-baseline", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-orientation", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
      mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnalign", "columnlines", "columnspacing", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lquote", "lspace", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
      xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
      MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
      ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
      TMPLIT_EXPR = seal(/\${[\w\W]*/g);
      DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
      ARIA_ATTR = seal(/^aria-[\-\w]+$/);
      IS_ALLOWED_URI = seal(
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
        // eslint-disable-line no-useless-escape
      );
      IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
      ATTR_WHITESPACE = seal(
        /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
        // eslint-disable-line no-control-regex
      );
      DOCTYPE_NAME = seal(/^html$/i);
      CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
      ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
      COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
      FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
      SELF_CLOSING_TAG = seal(/\/>/i);
      NODE_TYPE = {
        element: 1,
        attribute: 2,
        text: 3,
        cdataSection: 4,
        entityReference: 5,
        // Deprecated
        entityNode: 6,
        // Deprecated
        processingInstruction: 7,
        comment: 8,
        document: 9,
        documentType: 10,
        documentFragment: 11,
        notation: 12
        // Deprecated
      };
      getGlobal = function getGlobal2() {
        return typeof window === "undefined" ? null : window;
      };
      _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
        if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
          return null;
        }
        let suffix = null;
        const ATTR_NAME = "data-tt-policy-suffix";
        if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
          suffix = purifyHostElement.getAttribute(ATTR_NAME);
        }
        const policyName = "dompurify" + (suffix ? "#" + suffix : "");
        try {
          return trustedTypes.createPolicy(policyName, {
            createHTML(html3) {
              return html3;
            },
            createScriptURL(scriptUrl) {
              return scriptUrl;
            }
          });
        } catch (_) {
          console.warn("TrustedTypes policy " + policyName + " could not be created.");
          return null;
        }
      };
      _createHooksMap = function _createHooksMap2() {
        return {
          afterSanitizeAttributes: [],
          afterSanitizeElements: [],
          afterSanitizeShadowDOM: [],
          beforeSanitizeAttributes: [],
          beforeSanitizeElements: [],
          beforeSanitizeShadowDOM: [],
          uponSanitizeAttribute: [],
          uponSanitizeElement: [],
          uponSanitizeShadowNode: []
        };
      };
      _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options2) {
        return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options2.base ? clone(options2.base) : {}, cfg[key], options2.transform) : fallback;
      };
      purify = createDOMPurify();
    }
  });

  // node_modules/marked/lib/marked.esm.js
  function _getDefaults() {
    return {
      async: false,
      breaks: false,
      extensions: null,
      gfm: true,
      hooks: null,
      pedantic: false,
      renderer: null,
      silent: false,
      tokenizer: null,
      walkTokens: null
    };
  }
  function changeDefaults(newDefaults) {
    _defaults = newDefaults;
  }
  function edit(regex, opt = "") {
    let source = typeof regex === "string" ? regex : regex.source;
    const obj = {
      replace: (name, val) => {
        let valSource = typeof val === "string" ? val : val.source;
        valSource = valSource.replace(other.caret, "$1");
        source = source.replace(name, valSource);
        return obj;
      },
      getRegex: () => {
        return new RegExp(source, opt);
      }
    };
    return obj;
  }
  function escape2(html22, encode) {
    if (encode) {
      if (other.escapeTest.test(html22)) {
        return html22.replace(other.escapeReplace, getEscapeReplacement);
      }
    } else {
      if (other.escapeTestNoEncode.test(html22)) {
        return html22.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
      }
    }
    return html22;
  }
  function cleanUrl(href) {
    try {
      href = encodeURI(href).replace(other.percentDecode, "%");
    } catch {
      return null;
    }
    return href;
  }
  function splitCells(tableRow, count) {
    const row = tableRow.replace(other.findPipe, (match, offset, str) => {
      let escaped = false;
      let curr = offset;
      while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
      if (escaped) {
        return "|";
      } else {
        return " |";
      }
    }), cells = row.split(other.splitPipe);
    let i = 0;
    if (!cells[0].trim()) {
      cells.shift();
    }
    if (cells.length > 0 && !cells.at(-1)?.trim()) {
      cells.pop();
    }
    if (count) {
      if (cells.length > count) {
        cells.splice(count);
      } else {
        while (cells.length < count) cells.push("");
      }
    }
    for (; i < cells.length; i++) {
      cells[i] = cells[i].trim().replace(other.slashPipe, "|");
    }
    return cells;
  }
  function rtrim(str, c, invert) {
    const l = str.length;
    if (l === 0) {
      return "";
    }
    let suffLen = 0;
    while (suffLen < l) {
      const currChar = str.charAt(l - suffLen - 1);
      if (currChar === c && !invert) {
        suffLen++;
      } else if (currChar !== c && invert) {
        suffLen++;
      } else {
        break;
      }
    }
    return str.slice(0, l - suffLen);
  }
  function findClosingBracket(str, b) {
    if (str.indexOf(b[1]) === -1) {
      return -1;
    }
    let level = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\") {
        i++;
      } else if (str[i] === b[0]) {
        level++;
      } else if (str[i] === b[1]) {
        level--;
        if (level < 0) {
          return i;
        }
      }
    }
    if (level > 0) {
      return -2;
    }
    return -1;
  }
  function outputLink(cap, link2, raw, lexer2, rules) {
    const href = link2.href;
    const title = link2.title || null;
    const text2 = cap[1].replace(rules.other.outputLinkReplace, "$1");
    lexer2.state.inLink = true;
    const token = {
      type: cap[0].charAt(0) === "!" ? "image" : "link",
      raw,
      href,
      title,
      text: text2,
      tokens: lexer2.inlineTokens(text2)
    };
    lexer2.state.inLink = false;
    return token;
  }
  function indentCodeCompensation(raw, text2, rules) {
    const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
    if (matchIndentToCode === null) {
      return text2;
    }
    const indentToCode = matchIndentToCode[1];
    return text2.split("\n").map((node) => {
      const matchIndentInNode = node.match(rules.other.beginningSpace);
      if (matchIndentInNode === null) {
        return node;
      }
      const [indentInNode] = matchIndentInNode;
      if (indentInNode.length >= indentToCode.length) {
        return node.slice(indentToCode.length);
      }
      return node;
    }).join("\n");
  }
  function marked(src, opt) {
    return markedInstance.parse(src, opt);
  }
  var _defaults, noopTest, other, newline, blockCode, fences, hr, heading, bullet, lheadingCore, lheading, lheadingGfm, _paragraph, blockText, _blockLabel, def, list, _tag, _comment, html2, paragraph, blockquote, blockNormal, gfmTable, blockGfm, blockPedantic, escape, inlineCode, br, inlineText, _punctuation, _punctuationOrSpace, _notPunctuationOrSpace, punctuation, _punctuationGfmStrongEm, _punctuationOrSpaceGfmStrongEm, _notPunctuationOrSpaceGfmStrongEm, blockSkip, emStrongLDelimCore, emStrongLDelim, emStrongLDelimGfm, emStrongRDelimAstCore, emStrongRDelimAst, emStrongRDelimAstGfm, emStrongRDelimUnd, anyPunctuation, autolink, _inlineComment, tag, _inlineLabel, link, reflink, nolink, reflinkSearch, inlineNormal, inlinePedantic, inlineGfm, inlineBreaks, block, inline, escapeReplacements, getEscapeReplacement, _Tokenizer, _Lexer, _Renderer, _TextRenderer, _Parser, _Hooks, Marked, markedInstance, options, setOptions, use, walkTokens, parseInline, parser, lexer;
  var init_marked_esm = __esm({
    "node_modules/marked/lib/marked.esm.js"() {
      _defaults = _getDefaults();
      noopTest = { exec: () => null };
      other = {
        codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
        outputLinkReplace: /\\([\[\]])/g,
        indentCodeCompensation: /^(\s+)(?:```)/,
        beginningSpace: /^\s+/,
        endingHash: /#$/,
        startingSpaceChar: /^ /,
        endingSpaceChar: / $/,
        nonSpaceChar: /[^ ]/,
        newLineCharGlobal: /\n/g,
        tabCharGlobal: /\t/g,
        multipleSpaceGlobal: /\s+/g,
        blankLine: /^[ \t]*$/,
        doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
        blockquoteStart: /^ {0,3}>/,
        blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
        blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
        listReplaceTabs: /^\t+/,
        listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
        listIsTask: /^\[[ xX]\] /,
        listReplaceTask: /^\[[ xX]\] +/,
        anyLine: /\n.*\n/,
        hrefBrackets: /^<(.*)>$/,
        tableDelimiter: /[:|]/,
        tableAlignChars: /^\||\| *$/g,
        tableRowBlankLine: /\n[ \t]*$/,
        tableAlignRight: /^ *-+: *$/,
        tableAlignCenter: /^ *:-+: *$/,
        tableAlignLeft: /^ *:-+ *$/,
        startATag: /^<a /i,
        endATag: /^<\/a>/i,
        startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
        endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
        startAngleBracket: /^</,
        endAngleBracket: />$/,
        pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
        unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
        escapeTest: /[&<>"']/,
        escapeReplace: /[&<>"']/g,
        escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
        escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
        unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
        caret: /(^|[^\[])\^/g,
        percentDecode: /%25/g,
        findPipe: /\|/g,
        splitPipe: / \|/,
        slashPipe: /\\\|/g,
        carriageReturn: /\r\n|\r/g,
        spaceLine: /^ +$/gm,
        notSpaceStart: /^\S*/,
        endingNewline: /\n$/,
        listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
        nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
        hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
        fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
        headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
        htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
      };
      newline = /^(?:[ \t]*(?:\n|$))+/;
      blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
      fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
      hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
      heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
      bullet = /(?:[*+-]|\d{1,9}[.)])/;
      lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
      lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
      lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
      _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
      blockText = /^[^\n]+/;
      _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
      def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
      list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
      _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
      _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
      html2 = edit(
        "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
        "i"
      ).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
      paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
      blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
      blockNormal = {
        blockquote,
        code: blockCode,
        def,
        fences,
        heading,
        hr,
        html: html2,
        lheading,
        list,
        newline,
        paragraph,
        table: noopTest,
        text: blockText
      };
      gfmTable = edit(
        "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
      ).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
      blockGfm = {
        ...blockNormal,
        lheading: lheadingGfm,
        table: gfmTable,
        paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
      };
      blockPedantic = {
        ...blockNormal,
        html: edit(
          `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
        ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
        def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
        heading: /^(#{1,6})(.*)(?:\n+|$)/,
        fences: noopTest,
        // fences not supported
        lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
        paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
      };
      escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
      inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
      br = /^( {2,}|\\)\n(?!\s*$)/;
      inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
      _punctuation = /[\p{P}\p{S}]/u;
      _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
      _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
      punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
      _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
      _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
      _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
      blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
      emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
      emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
      emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
      emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
      emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
      emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
      emStrongRDelimUnd = edit(
        "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
        "gu"
      ).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
      anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
      autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
      _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
      tag = edit(
        "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
      ).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
      _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
      link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
      reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
      nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
      reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
      inlineNormal = {
        _backpedal: noopTest,
        // only used for GFM url
        anyPunctuation,
        autolink,
        blockSkip,
        br,
        code: inlineCode,
        del: noopTest,
        emStrongLDelim,
        emStrongRDelimAst,
        emStrongRDelimUnd,
        escape,
        link,
        nolink,
        punctuation,
        reflink,
        reflinkSearch,
        tag,
        text: inlineText,
        url: noopTest
      };
      inlinePedantic = {
        ...inlineNormal,
        link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
        reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
      };
      inlineGfm = {
        ...inlineNormal,
        emStrongRDelimAst: emStrongRDelimAstGfm,
        emStrongLDelim: emStrongLDelimGfm,
        url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
        _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
        del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
        text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
      };
      inlineBreaks = {
        ...inlineGfm,
        br: edit(br).replace("{2,}", "*").getRegex(),
        text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
      };
      block = {
        normal: blockNormal,
        gfm: blockGfm,
        pedantic: blockPedantic
      };
      inline = {
        normal: inlineNormal,
        gfm: inlineGfm,
        breaks: inlineBreaks,
        pedantic: inlinePedantic
      };
      escapeReplacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };
      getEscapeReplacement = (ch) => escapeReplacements[ch];
      _Tokenizer = class {
        options;
        rules;
        // set by the lexer
        lexer;
        // set by the lexer
        constructor(options2) {
          this.options = options2 || _defaults;
        }
        space(src) {
          const cap = this.rules.block.newline.exec(src);
          if (cap && cap[0].length > 0) {
            return {
              type: "space",
              raw: cap[0]
            };
          }
        }
        code(src) {
          const cap = this.rules.block.code.exec(src);
          if (cap) {
            const text2 = cap[0].replace(this.rules.other.codeRemoveIndent, "");
            return {
              type: "code",
              raw: cap[0],
              codeBlockStyle: "indented",
              text: !this.options.pedantic ? rtrim(text2, "\n") : text2
            };
          }
        }
        fences(src) {
          const cap = this.rules.block.fences.exec(src);
          if (cap) {
            const raw = cap[0];
            const text2 = indentCodeCompensation(raw, cap[3] || "", this.rules);
            return {
              type: "code",
              raw,
              lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
              text: text2
            };
          }
        }
        heading(src) {
          const cap = this.rules.block.heading.exec(src);
          if (cap) {
            let text2 = cap[2].trim();
            if (this.rules.other.endingHash.test(text2)) {
              const trimmed = rtrim(text2, "#");
              if (this.options.pedantic) {
                text2 = trimmed.trim();
              } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
                text2 = trimmed.trim();
              }
            }
            return {
              type: "heading",
              raw: cap[0],
              depth: cap[1].length,
              text: text2,
              tokens: this.lexer.inline(text2)
            };
          }
        }
        hr(src) {
          const cap = this.rules.block.hr.exec(src);
          if (cap) {
            return {
              type: "hr",
              raw: rtrim(cap[0], "\n")
            };
          }
        }
        blockquote(src) {
          const cap = this.rules.block.blockquote.exec(src);
          if (cap) {
            let lines = rtrim(cap[0], "\n").split("\n");
            let raw = "";
            let text2 = "";
            const tokens = [];
            while (lines.length > 0) {
              let inBlockquote = false;
              const currentLines = [];
              let i;
              for (i = 0; i < lines.length; i++) {
                if (this.rules.other.blockquoteStart.test(lines[i])) {
                  currentLines.push(lines[i]);
                  inBlockquote = true;
                } else if (!inBlockquote) {
                  currentLines.push(lines[i]);
                } else {
                  break;
                }
              }
              lines = lines.slice(i);
              const currentRaw = currentLines.join("\n");
              const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
              raw = raw ? `${raw}
${currentRaw}` : currentRaw;
              text2 = text2 ? `${text2}
${currentText}` : currentText;
              const top = this.lexer.state.top;
              this.lexer.state.top = true;
              this.lexer.blockTokens(currentText, tokens, true);
              this.lexer.state.top = top;
              if (lines.length === 0) {
                break;
              }
              const lastToken = tokens.at(-1);
              if (lastToken?.type === "code") {
                break;
              } else if (lastToken?.type === "blockquote") {
                const oldToken = lastToken;
                const newText = oldToken.raw + "\n" + lines.join("\n");
                const newToken = this.blockquote(newText);
                tokens[tokens.length - 1] = newToken;
                raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
                text2 = text2.substring(0, text2.length - oldToken.text.length) + newToken.text;
                break;
              } else if (lastToken?.type === "list") {
                const oldToken = lastToken;
                const newText = oldToken.raw + "\n" + lines.join("\n");
                const newToken = this.list(newText);
                tokens[tokens.length - 1] = newToken;
                raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
                text2 = text2.substring(0, text2.length - oldToken.raw.length) + newToken.raw;
                lines = newText.substring(tokens.at(-1).raw.length).split("\n");
                continue;
              }
            }
            return {
              type: "blockquote",
              raw,
              tokens,
              text: text2
            };
          }
        }
        list(src) {
          let cap = this.rules.block.list.exec(src);
          if (cap) {
            let bull = cap[1].trim();
            const isordered = bull.length > 1;
            const list2 = {
              type: "list",
              raw: "",
              ordered: isordered,
              start: isordered ? +bull.slice(0, -1) : "",
              loose: false,
              items: []
            };
            bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
            if (this.options.pedantic) {
              bull = isordered ? bull : "[*+-]";
            }
            const itemRegex = this.rules.other.listItemRegex(bull);
            let endsWithBlankLine = false;
            while (src) {
              let endEarly = false;
              let raw = "";
              let itemContents = "";
              if (!(cap = itemRegex.exec(src))) {
                break;
              }
              if (this.rules.block.hr.test(src)) {
                break;
              }
              raw = cap[0];
              src = src.substring(raw.length);
              let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
              let nextLine = src.split("\n", 1)[0];
              let blankLine = !line.trim();
              let indent = 0;
              if (this.options.pedantic) {
                indent = 2;
                itemContents = line.trimStart();
              } else if (blankLine) {
                indent = cap[1].length + 1;
              } else {
                indent = cap[2].search(this.rules.other.nonSpaceChar);
                indent = indent > 4 ? 1 : indent;
                itemContents = line.slice(indent);
                indent += cap[1].length;
              }
              if (blankLine && this.rules.other.blankLine.test(nextLine)) {
                raw += nextLine + "\n";
                src = src.substring(nextLine.length + 1);
                endEarly = true;
              }
              if (!endEarly) {
                const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
                const hrRegex = this.rules.other.hrRegex(indent);
                const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
                const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
                const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
                while (src) {
                  const rawLine = src.split("\n", 1)[0];
                  let nextLineWithoutTabs;
                  nextLine = rawLine;
                  if (this.options.pedantic) {
                    nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
                    nextLineWithoutTabs = nextLine;
                  } else {
                    nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
                  }
                  if (fencesBeginRegex.test(nextLine)) {
                    break;
                  }
                  if (headingBeginRegex.test(nextLine)) {
                    break;
                  }
                  if (htmlBeginRegex.test(nextLine)) {
                    break;
                  }
                  if (nextBulletRegex.test(nextLine)) {
                    break;
                  }
                  if (hrRegex.test(nextLine)) {
                    break;
                  }
                  if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
                    itemContents += "\n" + nextLineWithoutTabs.slice(indent);
                  } else {
                    if (blankLine) {
                      break;
                    }
                    if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                      break;
                    }
                    if (fencesBeginRegex.test(line)) {
                      break;
                    }
                    if (headingBeginRegex.test(line)) {
                      break;
                    }
                    if (hrRegex.test(line)) {
                      break;
                    }
                    itemContents += "\n" + nextLine;
                  }
                  if (!blankLine && !nextLine.trim()) {
                    blankLine = true;
                  }
                  raw += rawLine + "\n";
                  src = src.substring(rawLine.length + 1);
                  line = nextLineWithoutTabs.slice(indent);
                }
              }
              if (!list2.loose) {
                if (endsWithBlankLine) {
                  list2.loose = true;
                } else if (this.rules.other.doubleBlankLine.test(raw)) {
                  endsWithBlankLine = true;
                }
              }
              let istask = null;
              let ischecked;
              if (this.options.gfm) {
                istask = this.rules.other.listIsTask.exec(itemContents);
                if (istask) {
                  ischecked = istask[0] !== "[ ] ";
                  itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
                }
              }
              list2.items.push({
                type: "list_item",
                raw,
                task: !!istask,
                checked: ischecked,
                loose: false,
                text: itemContents,
                tokens: []
              });
              list2.raw += raw;
            }
            const lastItem = list2.items.at(-1);
            if (lastItem) {
              lastItem.raw = lastItem.raw.trimEnd();
              lastItem.text = lastItem.text.trimEnd();
            } else {
              return;
            }
            list2.raw = list2.raw.trimEnd();
            for (let i = 0; i < list2.items.length; i++) {
              this.lexer.state.top = false;
              list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
              if (!list2.loose) {
                const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
                const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
                list2.loose = hasMultipleLineBreaks;
              }
            }
            if (list2.loose) {
              for (let i = 0; i < list2.items.length; i++) {
                list2.items[i].loose = true;
              }
            }
            return list2;
          }
        }
        html(src) {
          const cap = this.rules.block.html.exec(src);
          if (cap) {
            const token = {
              type: "html",
              block: true,
              raw: cap[0],
              pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
              text: cap[0]
            };
            return token;
          }
        }
        def(src) {
          const cap = this.rules.block.def.exec(src);
          if (cap) {
            const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
            const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
            const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
            return {
              type: "def",
              tag: tag2,
              raw: cap[0],
              href,
              title
            };
          }
        }
        table(src) {
          const cap = this.rules.block.table.exec(src);
          if (!cap) {
            return;
          }
          if (!this.rules.other.tableDelimiter.test(cap[2])) {
            return;
          }
          const headers = splitCells(cap[1]);
          const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
          const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
          const item = {
            type: "table",
            raw: cap[0],
            header: [],
            align: [],
            rows: []
          };
          if (headers.length !== aligns.length) {
            return;
          }
          for (const align of aligns) {
            if (this.rules.other.tableAlignRight.test(align)) {
              item.align.push("right");
            } else if (this.rules.other.tableAlignCenter.test(align)) {
              item.align.push("center");
            } else if (this.rules.other.tableAlignLeft.test(align)) {
              item.align.push("left");
            } else {
              item.align.push(null);
            }
          }
          for (let i = 0; i < headers.length; i++) {
            item.header.push({
              text: headers[i],
              tokens: this.lexer.inline(headers[i]),
              header: true,
              align: item.align[i]
            });
          }
          for (const row of rows) {
            item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
              return {
                text: cell,
                tokens: this.lexer.inline(cell),
                header: false,
                align: item.align[i]
              };
            }));
          }
          return item;
        }
        lheading(src) {
          const cap = this.rules.block.lheading.exec(src);
          if (cap) {
            return {
              type: "heading",
              raw: cap[0],
              depth: cap[2].charAt(0) === "=" ? 1 : 2,
              text: cap[1],
              tokens: this.lexer.inline(cap[1])
            };
          }
        }
        paragraph(src) {
          const cap = this.rules.block.paragraph.exec(src);
          if (cap) {
            const text2 = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
            return {
              type: "paragraph",
              raw: cap[0],
              text: text2,
              tokens: this.lexer.inline(text2)
            };
          }
        }
        text(src) {
          const cap = this.rules.block.text.exec(src);
          if (cap) {
            return {
              type: "text",
              raw: cap[0],
              text: cap[0],
              tokens: this.lexer.inline(cap[0])
            };
          }
        }
        escape(src) {
          const cap = this.rules.inline.escape.exec(src);
          if (cap) {
            return {
              type: "escape",
              raw: cap[0],
              text: cap[1]
            };
          }
        }
        tag(src) {
          const cap = this.rules.inline.tag.exec(src);
          if (cap) {
            if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
              this.lexer.state.inLink = true;
            } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
              this.lexer.state.inLink = false;
            }
            if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
              this.lexer.state.inRawBlock = true;
            } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
              this.lexer.state.inRawBlock = false;
            }
            return {
              type: "html",
              raw: cap[0],
              inLink: this.lexer.state.inLink,
              inRawBlock: this.lexer.state.inRawBlock,
              block: false,
              text: cap[0]
            };
          }
        }
        link(src) {
          const cap = this.rules.inline.link.exec(src);
          if (cap) {
            const trimmedUrl = cap[2].trim();
            if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
              if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
                return;
              }
              const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
              if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
                return;
              }
            } else {
              const lastParenIndex = findClosingBracket(cap[2], "()");
              if (lastParenIndex === -2) {
                return;
              }
              if (lastParenIndex > -1) {
                const start = cap[0].indexOf("!") === 0 ? 5 : 4;
                const linkLen = start + cap[1].length + lastParenIndex;
                cap[2] = cap[2].substring(0, lastParenIndex);
                cap[0] = cap[0].substring(0, linkLen).trim();
                cap[3] = "";
              }
            }
            let href = cap[2];
            let title = "";
            if (this.options.pedantic) {
              const link2 = this.rules.other.pedanticHrefTitle.exec(href);
              if (link2) {
                href = link2[1];
                title = link2[3];
              }
            } else {
              title = cap[3] ? cap[3].slice(1, -1) : "";
            }
            href = href.trim();
            if (this.rules.other.startAngleBracket.test(href)) {
              if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
                href = href.slice(1);
              } else {
                href = href.slice(1, -1);
              }
            }
            return outputLink(cap, {
              href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
              title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
            }, cap[0], this.lexer, this.rules);
          }
        }
        reflink(src, links) {
          let cap;
          if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
            const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
            const link2 = links[linkString.toLowerCase()];
            if (!link2) {
              const text2 = cap[0].charAt(0);
              return {
                type: "text",
                raw: text2,
                text: text2
              };
            }
            return outputLink(cap, link2, cap[0], this.lexer, this.rules);
          }
        }
        emStrong(src, maskedSrc, prevChar = "") {
          let match = this.rules.inline.emStrongLDelim.exec(src);
          if (!match) return;
          if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
          const nextChar = match[1] || match[2] || "";
          if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
            const lLength = [...match[0]].length - 1;
            let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
            const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
            endReg.lastIndex = 0;
            maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
            while ((match = endReg.exec(maskedSrc)) != null) {
              rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
              if (!rDelim) continue;
              rLength = [...rDelim].length;
              if (match[3] || match[4]) {
                delimTotal += rLength;
                continue;
              } else if (match[5] || match[6]) {
                if (lLength % 3 && !((lLength + rLength) % 3)) {
                  midDelimTotal += rLength;
                  continue;
                }
              }
              delimTotal -= rLength;
              if (delimTotal > 0) continue;
              rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
              const lastCharLength = [...match[0]][0].length;
              const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
              if (Math.min(lLength, rLength) % 2) {
                const text22 = raw.slice(1, -1);
                return {
                  type: "em",
                  raw,
                  text: text22,
                  tokens: this.lexer.inlineTokens(text22)
                };
              }
              const text2 = raw.slice(2, -2);
              return {
                type: "strong",
                raw,
                text: text2,
                tokens: this.lexer.inlineTokens(text2)
              };
            }
          }
        }
        codespan(src) {
          const cap = this.rules.inline.code.exec(src);
          if (cap) {
            let text2 = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
            const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text2);
            const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text2) && this.rules.other.endingSpaceChar.test(text2);
            if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
              text2 = text2.substring(1, text2.length - 1);
            }
            return {
              type: "codespan",
              raw: cap[0],
              text: text2
            };
          }
        }
        br(src) {
          const cap = this.rules.inline.br.exec(src);
          if (cap) {
            return {
              type: "br",
              raw: cap[0]
            };
          }
        }
        del(src) {
          const cap = this.rules.inline.del.exec(src);
          if (cap) {
            return {
              type: "del",
              raw: cap[0],
              text: cap[2],
              tokens: this.lexer.inlineTokens(cap[2])
            };
          }
        }
        autolink(src) {
          const cap = this.rules.inline.autolink.exec(src);
          if (cap) {
            let text2, href;
            if (cap[2] === "@") {
              text2 = cap[1];
              href = "mailto:" + text2;
            } else {
              text2 = cap[1];
              href = text2;
            }
            return {
              type: "link",
              raw: cap[0],
              text: text2,
              href,
              tokens: [
                {
                  type: "text",
                  raw: text2,
                  text: text2
                }
              ]
            };
          }
        }
        url(src) {
          let cap;
          if (cap = this.rules.inline.url.exec(src)) {
            let text2, href;
            if (cap[2] === "@") {
              text2 = cap[0];
              href = "mailto:" + text2;
            } else {
              let prevCapZero;
              do {
                prevCapZero = cap[0];
                cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
              } while (prevCapZero !== cap[0]);
              text2 = cap[0];
              if (cap[1] === "www.") {
                href = "http://" + cap[0];
              } else {
                href = cap[0];
              }
            }
            return {
              type: "link",
              raw: cap[0],
              text: text2,
              href,
              tokens: [
                {
                  type: "text",
                  raw: text2,
                  text: text2
                }
              ]
            };
          }
        }
        inlineText(src) {
          const cap = this.rules.inline.text.exec(src);
          if (cap) {
            const escaped = this.lexer.state.inRawBlock;
            return {
              type: "text",
              raw: cap[0],
              text: cap[0],
              escaped
            };
          }
        }
      };
      _Lexer = class __Lexer {
        tokens;
        options;
        state;
        tokenizer;
        inlineQueue;
        constructor(options2) {
          this.tokens = [];
          this.tokens.links = /* @__PURE__ */ Object.create(null);
          this.options = options2 || _defaults;
          this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
          this.tokenizer = this.options.tokenizer;
          this.tokenizer.options = this.options;
          this.tokenizer.lexer = this;
          this.inlineQueue = [];
          this.state = {
            inLink: false,
            inRawBlock: false,
            top: true
          };
          const rules = {
            other,
            block: block.normal,
            inline: inline.normal
          };
          if (this.options.pedantic) {
            rules.block = block.pedantic;
            rules.inline = inline.pedantic;
          } else if (this.options.gfm) {
            rules.block = block.gfm;
            if (this.options.breaks) {
              rules.inline = inline.breaks;
            } else {
              rules.inline = inline.gfm;
            }
          }
          this.tokenizer.rules = rules;
        }
        /**
         * Expose Rules
         */
        static get rules() {
          return {
            block,
            inline
          };
        }
        /**
         * Static Lex Method
         */
        static lex(src, options2) {
          const lexer2 = new __Lexer(options2);
          return lexer2.lex(src);
        }
        /**
         * Static Lex Inline Method
         */
        static lexInline(src, options2) {
          const lexer2 = new __Lexer(options2);
          return lexer2.inlineTokens(src);
        }
        /**
         * Preprocessing
         */
        lex(src) {
          src = src.replace(other.carriageReturn, "\n");
          this.blockTokens(src, this.tokens);
          for (let i = 0; i < this.inlineQueue.length; i++) {
            const next = this.inlineQueue[i];
            this.inlineTokens(next.src, next.tokens);
          }
          this.inlineQueue = [];
          return this.tokens;
        }
        blockTokens(src, tokens = [], lastParagraphClipped = false) {
          if (this.options.pedantic) {
            src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
          }
          while (src) {
            let token;
            if (this.options.extensions?.block?.some((extTokenizer) => {
              if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                return true;
              }
              return false;
            })) {
              continue;
            }
            if (token = this.tokenizer.space(src)) {
              src = src.substring(token.raw.length);
              const lastToken = tokens.at(-1);
              if (token.raw.length === 1 && lastToken !== void 0) {
                lastToken.raw += "\n";
              } else {
                tokens.push(token);
              }
              continue;
            }
            if (token = this.tokenizer.code(src)) {
              src = src.substring(token.raw.length);
              const lastToken = tokens.at(-1);
              if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
                lastToken.raw += "\n" + token.raw;
                lastToken.text += "\n" + token.text;
                this.inlineQueue.at(-1).src = lastToken.text;
              } else {
                tokens.push(token);
              }
              continue;
            }
            if (token = this.tokenizer.fences(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.heading(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.hr(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.blockquote(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.list(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.html(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.def(src)) {
              src = src.substring(token.raw.length);
              const lastToken = tokens.at(-1);
              if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
                lastToken.raw += "\n" + token.raw;
                lastToken.text += "\n" + token.raw;
                this.inlineQueue.at(-1).src = lastToken.text;
              } else if (!this.tokens.links[token.tag]) {
                this.tokens.links[token.tag] = {
                  href: token.href,
                  title: token.title
                };
              }
              continue;
            }
            if (token = this.tokenizer.table(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.lheading(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            let cutSrc = src;
            if (this.options.extensions?.startBlock) {
              let startIndex = Infinity;
              const tempSrc = src.slice(1);
              let tempStart;
              this.options.extensions.startBlock.forEach((getStartIndex) => {
                tempStart = getStartIndex.call({ lexer: this }, tempSrc);
                if (typeof tempStart === "number" && tempStart >= 0) {
                  startIndex = Math.min(startIndex, tempStart);
                }
              });
              if (startIndex < Infinity && startIndex >= 0) {
                cutSrc = src.substring(0, startIndex + 1);
              }
            }
            if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
              const lastToken = tokens.at(-1);
              if (lastParagraphClipped && lastToken?.type === "paragraph") {
                lastToken.raw += "\n" + token.raw;
                lastToken.text += "\n" + token.text;
                this.inlineQueue.pop();
                this.inlineQueue.at(-1).src = lastToken.text;
              } else {
                tokens.push(token);
              }
              lastParagraphClipped = cutSrc.length !== src.length;
              src = src.substring(token.raw.length);
              continue;
            }
            if (token = this.tokenizer.text(src)) {
              src = src.substring(token.raw.length);
              const lastToken = tokens.at(-1);
              if (lastToken?.type === "text") {
                lastToken.raw += "\n" + token.raw;
                lastToken.text += "\n" + token.text;
                this.inlineQueue.pop();
                this.inlineQueue.at(-1).src = lastToken.text;
              } else {
                tokens.push(token);
              }
              continue;
            }
            if (src) {
              const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
              if (this.options.silent) {
                console.error(errMsg);
                break;
              } else {
                throw new Error(errMsg);
              }
            }
          }
          this.state.top = true;
          return tokens;
        }
        inline(src, tokens = []) {
          this.inlineQueue.push({ src, tokens });
          return tokens;
        }
        /**
         * Lexing/Compiling
         */
        inlineTokens(src, tokens = []) {
          let maskedSrc = src;
          let match = null;
          if (this.tokens.links) {
            const links = Object.keys(this.tokens.links);
            if (links.length > 0) {
              while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
                if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
                  maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
                }
              }
            }
          }
          while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
            maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
          }
          while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
          }
          let keepPrevChar = false;
          let prevChar = "";
          while (src) {
            if (!keepPrevChar) {
              prevChar = "";
            }
            keepPrevChar = false;
            let token;
            if (this.options.extensions?.inline?.some((extTokenizer) => {
              if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
                src = src.substring(token.raw.length);
                tokens.push(token);
                return true;
              }
              return false;
            })) {
              continue;
            }
            if (token = this.tokenizer.escape(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.tag(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.link(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.reflink(src, this.tokens.links)) {
              src = src.substring(token.raw.length);
              const lastToken = tokens.at(-1);
              if (token.type === "text" && lastToken?.type === "text") {
                lastToken.raw += token.raw;
                lastToken.text += token.text;
              } else {
                tokens.push(token);
              }
              continue;
            }
            if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.codespan(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.br(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.del(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (token = this.tokenizer.autolink(src)) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            if (!this.state.inLink && (token = this.tokenizer.url(src))) {
              src = src.substring(token.raw.length);
              tokens.push(token);
              continue;
            }
            let cutSrc = src;
            if (this.options.extensions?.startInline) {
              let startIndex = Infinity;
              const tempSrc = src.slice(1);
              let tempStart;
              this.options.extensions.startInline.forEach((getStartIndex) => {
                tempStart = getStartIndex.call({ lexer: this }, tempSrc);
                if (typeof tempStart === "number" && tempStart >= 0) {
                  startIndex = Math.min(startIndex, tempStart);
                }
              });
              if (startIndex < Infinity && startIndex >= 0) {
                cutSrc = src.substring(0, startIndex + 1);
              }
            }
            if (token = this.tokenizer.inlineText(cutSrc)) {
              src = src.substring(token.raw.length);
              if (token.raw.slice(-1) !== "_") {
                prevChar = token.raw.slice(-1);
              }
              keepPrevChar = true;
              const lastToken = tokens.at(-1);
              if (lastToken?.type === "text") {
                lastToken.raw += token.raw;
                lastToken.text += token.text;
              } else {
                tokens.push(token);
              }
              continue;
            }
            if (src) {
              const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
              if (this.options.silent) {
                console.error(errMsg);
                break;
              } else {
                throw new Error(errMsg);
              }
            }
          }
          return tokens;
        }
      };
      _Renderer = class {
        options;
        parser;
        // set by the parser
        constructor(options2) {
          this.options = options2 || _defaults;
        }
        space(token) {
          return "";
        }
        code({ text: text2, lang, escaped }) {
          const langString = (lang || "").match(other.notSpaceStart)?.[0];
          const code = text2.replace(other.endingNewline, "") + "\n";
          if (!langString) {
            return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
          }
          return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
        }
        blockquote({ tokens }) {
          const body = this.parser.parse(tokens);
          return `<blockquote>
${body}</blockquote>
`;
        }
        html({ text: text2 }) {
          return text2;
        }
        heading({ tokens, depth }) {
          return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
        }
        hr(token) {
          return "<hr>\n";
        }
        list(token) {
          const ordered = token.ordered;
          const start = token.start;
          let body = "";
          for (let j = 0; j < token.items.length; j++) {
            const item = token.items[j];
            body += this.listitem(item);
          }
          const type = ordered ? "ol" : "ul";
          const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
          return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
        }
        listitem(item) {
          let itemBody = "";
          if (item.task) {
            const checkbox = this.checkbox({ checked: !!item.checked });
            if (item.loose) {
              if (item.tokens[0]?.type === "paragraph") {
                item.tokens[0].text = checkbox + " " + item.tokens[0].text;
                if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
                  item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
                  item.tokens[0].tokens[0].escaped = true;
                }
              } else {
                item.tokens.unshift({
                  type: "text",
                  raw: checkbox + " ",
                  text: checkbox + " ",
                  escaped: true
                });
              }
            } else {
              itemBody += checkbox + " ";
            }
          }
          itemBody += this.parser.parse(item.tokens, !!item.loose);
          return `<li>${itemBody}</li>
`;
        }
        checkbox({ checked }) {
          return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
        }
        paragraph({ tokens }) {
          return `<p>${this.parser.parseInline(tokens)}</p>
`;
        }
        table(token) {
          let header = "";
          let cell = "";
          for (let j = 0; j < token.header.length; j++) {
            cell += this.tablecell(token.header[j]);
          }
          header += this.tablerow({ text: cell });
          let body = "";
          for (let j = 0; j < token.rows.length; j++) {
            const row = token.rows[j];
            cell = "";
            for (let k = 0; k < row.length; k++) {
              cell += this.tablecell(row[k]);
            }
            body += this.tablerow({ text: cell });
          }
          if (body) body = `<tbody>${body}</tbody>`;
          return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
        }
        tablerow({ text: text2 }) {
          return `<tr>
${text2}</tr>
`;
        }
        tablecell(token) {
          const content = this.parser.parseInline(token.tokens);
          const type = token.header ? "th" : "td";
          const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
          return tag2 + content + `</${type}>
`;
        }
        /**
         * span level renderer
         */
        strong({ tokens }) {
          return `<strong>${this.parser.parseInline(tokens)}</strong>`;
        }
        em({ tokens }) {
          return `<em>${this.parser.parseInline(tokens)}</em>`;
        }
        codespan({ text: text2 }) {
          return `<code>${escape2(text2, true)}</code>`;
        }
        br(token) {
          return "<br>";
        }
        del({ tokens }) {
          return `<del>${this.parser.parseInline(tokens)}</del>`;
        }
        link({ href, title, tokens }) {
          const text2 = this.parser.parseInline(tokens);
          const cleanHref = cleanUrl(href);
          if (cleanHref === null) {
            return text2;
          }
          href = cleanHref;
          let out = '<a href="' + href + '"';
          if (title) {
            out += ' title="' + escape2(title) + '"';
          }
          out += ">" + text2 + "</a>";
          return out;
        }
        image({ href, title, text: text2, tokens }) {
          if (tokens) {
            text2 = this.parser.parseInline(tokens, this.parser.textRenderer);
          }
          const cleanHref = cleanUrl(href);
          if (cleanHref === null) {
            return escape2(text2);
          }
          href = cleanHref;
          let out = `<img src="${href}" alt="${text2}"`;
          if (title) {
            out += ` title="${escape2(title)}"`;
          }
          out += ">";
          return out;
        }
        text(token) {
          return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
        }
      };
      _TextRenderer = class {
        // no need for block level renderers
        strong({ text: text2 }) {
          return text2;
        }
        em({ text: text2 }) {
          return text2;
        }
        codespan({ text: text2 }) {
          return text2;
        }
        del({ text: text2 }) {
          return text2;
        }
        html({ text: text2 }) {
          return text2;
        }
        text({ text: text2 }) {
          return text2;
        }
        link({ text: text2 }) {
          return "" + text2;
        }
        image({ text: text2 }) {
          return "" + text2;
        }
        br() {
          return "";
        }
      };
      _Parser = class __Parser {
        options;
        renderer;
        textRenderer;
        constructor(options2) {
          this.options = options2 || _defaults;
          this.options.renderer = this.options.renderer || new _Renderer();
          this.renderer = this.options.renderer;
          this.renderer.options = this.options;
          this.renderer.parser = this;
          this.textRenderer = new _TextRenderer();
        }
        /**
         * Static Parse Method
         */
        static parse(tokens, options2) {
          const parser2 = new __Parser(options2);
          return parser2.parse(tokens);
        }
        /**
         * Static Parse Inline Method
         */
        static parseInline(tokens, options2) {
          const parser2 = new __Parser(options2);
          return parser2.parseInline(tokens);
        }
        /**
         * Parse Loop
         */
        parse(tokens, top = true) {
          let out = "";
          for (let i = 0; i < tokens.length; i++) {
            const anyToken = tokens[i];
            if (this.options.extensions?.renderers?.[anyToken.type]) {
              const genericToken = anyToken;
              const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
              if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
                out += ret || "";
                continue;
              }
            }
            const token = anyToken;
            switch (token.type) {
              case "space": {
                out += this.renderer.space(token);
                continue;
              }
              case "hr": {
                out += this.renderer.hr(token);
                continue;
              }
              case "heading": {
                out += this.renderer.heading(token);
                continue;
              }
              case "code": {
                out += this.renderer.code(token);
                continue;
              }
              case "table": {
                out += this.renderer.table(token);
                continue;
              }
              case "blockquote": {
                out += this.renderer.blockquote(token);
                continue;
              }
              case "list": {
                out += this.renderer.list(token);
                continue;
              }
              case "html": {
                out += this.renderer.html(token);
                continue;
              }
              case "paragraph": {
                out += this.renderer.paragraph(token);
                continue;
              }
              case "text": {
                let textToken = token;
                let body = this.renderer.text(textToken);
                while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
                  textToken = tokens[++i];
                  body += "\n" + this.renderer.text(textToken);
                }
                if (top) {
                  out += this.renderer.paragraph({
                    type: "paragraph",
                    raw: body,
                    text: body,
                    tokens: [{ type: "text", raw: body, text: body, escaped: true }]
                  });
                } else {
                  out += body;
                }
                continue;
              }
              default: {
                const errMsg = 'Token with "' + token.type + '" type was not found.';
                if (this.options.silent) {
                  console.error(errMsg);
                  return "";
                } else {
                  throw new Error(errMsg);
                }
              }
            }
          }
          return out;
        }
        /**
         * Parse Inline Tokens
         */
        parseInline(tokens, renderer = this.renderer) {
          let out = "";
          for (let i = 0; i < tokens.length; i++) {
            const anyToken = tokens[i];
            if (this.options.extensions?.renderers?.[anyToken.type]) {
              const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
              if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
                out += ret || "";
                continue;
              }
            }
            const token = anyToken;
            switch (token.type) {
              case "escape": {
                out += renderer.text(token);
                break;
              }
              case "html": {
                out += renderer.html(token);
                break;
              }
              case "link": {
                out += renderer.link(token);
                break;
              }
              case "image": {
                out += renderer.image(token);
                break;
              }
              case "strong": {
                out += renderer.strong(token);
                break;
              }
              case "em": {
                out += renderer.em(token);
                break;
              }
              case "codespan": {
                out += renderer.codespan(token);
                break;
              }
              case "br": {
                out += renderer.br(token);
                break;
              }
              case "del": {
                out += renderer.del(token);
                break;
              }
              case "text": {
                out += renderer.text(token);
                break;
              }
              default: {
                const errMsg = 'Token with "' + token.type + '" type was not found.';
                if (this.options.silent) {
                  console.error(errMsg);
                  return "";
                } else {
                  throw new Error(errMsg);
                }
              }
            }
          }
          return out;
        }
      };
      _Hooks = class {
        options;
        block;
        constructor(options2) {
          this.options = options2 || _defaults;
        }
        static passThroughHooks = /* @__PURE__ */ new Set([
          "preprocess",
          "postprocess",
          "processAllTokens"
        ]);
        /**
         * Process markdown before marked
         */
        preprocess(markdown) {
          return markdown;
        }
        /**
         * Process HTML after marked is finished
         */
        postprocess(html22) {
          return html22;
        }
        /**
         * Process all tokens before walk tokens
         */
        processAllTokens(tokens) {
          return tokens;
        }
        /**
         * Provide function to tokenize markdown
         */
        provideLexer() {
          return this.block ? _Lexer.lex : _Lexer.lexInline;
        }
        /**
         * Provide function to parse tokens
         */
        provideParser() {
          return this.block ? _Parser.parse : _Parser.parseInline;
        }
      };
      Marked = class {
        defaults = _getDefaults();
        options = this.setOptions;
        parse = this.parseMarkdown(true);
        parseInline = this.parseMarkdown(false);
        Parser = _Parser;
        Renderer = _Renderer;
        TextRenderer = _TextRenderer;
        Lexer = _Lexer;
        Tokenizer = _Tokenizer;
        Hooks = _Hooks;
        constructor(...args) {
          this.use(...args);
        }
        /**
         * Run callback for every token
         */
        walkTokens(tokens, callback) {
          let values = [];
          for (const token of tokens) {
            values = values.concat(callback.call(this, token));
            switch (token.type) {
              case "table": {
                const tableToken = token;
                for (const cell of tableToken.header) {
                  values = values.concat(this.walkTokens(cell.tokens, callback));
                }
                for (const row of tableToken.rows) {
                  for (const cell of row) {
                    values = values.concat(this.walkTokens(cell.tokens, callback));
                  }
                }
                break;
              }
              case "list": {
                const listToken = token;
                values = values.concat(this.walkTokens(listToken.items, callback));
                break;
              }
              default: {
                const genericToken = token;
                if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
                  this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
                    const tokens2 = genericToken[childTokens].flat(Infinity);
                    values = values.concat(this.walkTokens(tokens2, callback));
                  });
                } else if (genericToken.tokens) {
                  values = values.concat(this.walkTokens(genericToken.tokens, callback));
                }
              }
            }
          }
          return values;
        }
        use(...args) {
          const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
          args.forEach((pack) => {
            const opts = { ...pack };
            opts.async = this.defaults.async || opts.async || false;
            if (pack.extensions) {
              pack.extensions.forEach((ext) => {
                if (!ext.name) {
                  throw new Error("extension name required");
                }
                if ("renderer" in ext) {
                  const prevRenderer = extensions.renderers[ext.name];
                  if (prevRenderer) {
                    extensions.renderers[ext.name] = function(...args2) {
                      let ret = ext.renderer.apply(this, args2);
                      if (ret === false) {
                        ret = prevRenderer.apply(this, args2);
                      }
                      return ret;
                    };
                  } else {
                    extensions.renderers[ext.name] = ext.renderer;
                  }
                }
                if ("tokenizer" in ext) {
                  if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
                    throw new Error("extension level must be 'block' or 'inline'");
                  }
                  const extLevel = extensions[ext.level];
                  if (extLevel) {
                    extLevel.unshift(ext.tokenizer);
                  } else {
                    extensions[ext.level] = [ext.tokenizer];
                  }
                  if (ext.start) {
                    if (ext.level === "block") {
                      if (extensions.startBlock) {
                        extensions.startBlock.push(ext.start);
                      } else {
                        extensions.startBlock = [ext.start];
                      }
                    } else if (ext.level === "inline") {
                      if (extensions.startInline) {
                        extensions.startInline.push(ext.start);
                      } else {
                        extensions.startInline = [ext.start];
                      }
                    }
                  }
                }
                if ("childTokens" in ext && ext.childTokens) {
                  extensions.childTokens[ext.name] = ext.childTokens;
                }
              });
              opts.extensions = extensions;
            }
            if (pack.renderer) {
              const renderer = this.defaults.renderer || new _Renderer(this.defaults);
              for (const prop in pack.renderer) {
                if (!(prop in renderer)) {
                  throw new Error(`renderer '${prop}' does not exist`);
                }
                if (["options", "parser"].includes(prop)) {
                  continue;
                }
                const rendererProp = prop;
                const rendererFunc = pack.renderer[rendererProp];
                const prevRenderer = renderer[rendererProp];
                renderer[rendererProp] = (...args2) => {
                  let ret = rendererFunc.apply(renderer, args2);
                  if (ret === false) {
                    ret = prevRenderer.apply(renderer, args2);
                  }
                  return ret || "";
                };
              }
              opts.renderer = renderer;
            }
            if (pack.tokenizer) {
              const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
              for (const prop in pack.tokenizer) {
                if (!(prop in tokenizer)) {
                  throw new Error(`tokenizer '${prop}' does not exist`);
                }
                if (["options", "rules", "lexer"].includes(prop)) {
                  continue;
                }
                const tokenizerProp = prop;
                const tokenizerFunc = pack.tokenizer[tokenizerProp];
                const prevTokenizer = tokenizer[tokenizerProp];
                tokenizer[tokenizerProp] = (...args2) => {
                  let ret = tokenizerFunc.apply(tokenizer, args2);
                  if (ret === false) {
                    ret = prevTokenizer.apply(tokenizer, args2);
                  }
                  return ret;
                };
              }
              opts.tokenizer = tokenizer;
            }
            if (pack.hooks) {
              const hooks = this.defaults.hooks || new _Hooks();
              for (const prop in pack.hooks) {
                if (!(prop in hooks)) {
                  throw new Error(`hook '${prop}' does not exist`);
                }
                if (["options", "block"].includes(prop)) {
                  continue;
                }
                const hooksProp = prop;
                const hooksFunc = pack.hooks[hooksProp];
                const prevHook = hooks[hooksProp];
                if (_Hooks.passThroughHooks.has(prop)) {
                  hooks[hooksProp] = (arg) => {
                    if (this.defaults.async) {
                      return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                        return prevHook.call(hooks, ret2);
                      });
                    }
                    const ret = hooksFunc.call(hooks, arg);
                    return prevHook.call(hooks, ret);
                  };
                } else {
                  hooks[hooksProp] = (...args2) => {
                    let ret = hooksFunc.apply(hooks, args2);
                    if (ret === false) {
                      ret = prevHook.apply(hooks, args2);
                    }
                    return ret;
                  };
                }
              }
              opts.hooks = hooks;
            }
            if (pack.walkTokens) {
              const walkTokens2 = this.defaults.walkTokens;
              const packWalktokens = pack.walkTokens;
              opts.walkTokens = function(token) {
                let values = [];
                values.push(packWalktokens.call(this, token));
                if (walkTokens2) {
                  values = values.concat(walkTokens2.call(this, token));
                }
                return values;
              };
            }
            this.defaults = { ...this.defaults, ...opts };
          });
          return this;
        }
        setOptions(opt) {
          this.defaults = { ...this.defaults, ...opt };
          return this;
        }
        lexer(src, options2) {
          return _Lexer.lex(src, options2 ?? this.defaults);
        }
        parser(tokens, options2) {
          return _Parser.parse(tokens, options2 ?? this.defaults);
        }
        parseMarkdown(blockType) {
          const parse2 = (src, options2) => {
            const origOpt = { ...options2 };
            const opt = { ...this.defaults, ...origOpt };
            const throwError = this.onError(!!opt.silent, !!opt.async);
            if (this.defaults.async === true && origOpt.async === false) {
              return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
            }
            if (typeof src === "undefined" || src === null) {
              return throwError(new Error("marked(): input parameter is undefined or null"));
            }
            if (typeof src !== "string") {
              return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
            }
            if (opt.hooks) {
              opt.hooks.options = opt;
              opt.hooks.block = blockType;
            }
            const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
            const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
            if (opt.async) {
              return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html22) => opt.hooks ? opt.hooks.postprocess(html22) : html22).catch(throwError);
            }
            try {
              if (opt.hooks) {
                src = opt.hooks.preprocess(src);
              }
              let tokens = lexer2(src, opt);
              if (opt.hooks) {
                tokens = opt.hooks.processAllTokens(tokens);
              }
              if (opt.walkTokens) {
                this.walkTokens(tokens, opt.walkTokens);
              }
              let html22 = parser2(tokens, opt);
              if (opt.hooks) {
                html22 = opt.hooks.postprocess(html22);
              }
              return html22;
            } catch (e) {
              return throwError(e);
            }
          };
          return parse2;
        }
        onError(silent, async) {
          return (e) => {
            e.message += "\nPlease report this to https://github.com/markedjs/marked.";
            if (silent) {
              const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
              if (async) {
                return Promise.resolve(msg);
              }
              return msg;
            }
            if (async) {
              return Promise.reject(e);
            }
            throw e;
          };
        }
      };
      markedInstance = new Marked();
      marked.options = marked.setOptions = function(options2) {
        markedInstance.setOptions(options2);
        marked.defaults = markedInstance.defaults;
        changeDefaults(marked.defaults);
        return marked;
      };
      marked.getDefaults = _getDefaults;
      marked.defaults = _defaults;
      marked.use = function(...args) {
        markedInstance.use(...args);
        marked.defaults = markedInstance.defaults;
        changeDefaults(marked.defaults);
        return marked;
      };
      marked.walkTokens = function(tokens, callback) {
        return markedInstance.walkTokens(tokens, callback);
      };
      marked.parseInline = markedInstance.parseInline;
      marked.Parser = _Parser;
      marked.parser = _Parser.parse;
      marked.Renderer = _Renderer;
      marked.TextRenderer = _TextRenderer;
      marked.Lexer = _Lexer;
      marked.lexer = _Lexer.lex;
      marked.Tokenizer = _Tokenizer;
      marked.Hooks = _Hooks;
      marked.parse = marked;
      options = marked.options;
      setOptions = marked.setOptions;
      use = marked.use;
      walkTokens = marked.walkTokens;
      parseInline = marked.parseInline;
      parser = _Parser.parse;
      lexer = _Lexer.lex;
    }
  });

  // node_modules/morphdom/dist/morphdom-esm.js
  function morphAttrs(fromNode, toNode) {
    var toNodeAttrs = toNode.attributes;
    var attr;
    var attrName;
    var attrNamespaceURI;
    var attrValue;
    var fromValue;
    if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE || fromNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
      return;
    }
    for (var i = toNodeAttrs.length - 1; i >= 0; i--) {
      attr = toNodeAttrs[i];
      attrName = attr.name;
      attrNamespaceURI = attr.namespaceURI;
      attrValue = attr.value;
      if (attrNamespaceURI) {
        attrName = attr.localName || attrName;
        fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);
        if (fromValue !== attrValue) {
          if (attr.prefix === "xmlns") {
            attrName = attr.name;
          }
          fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
        }
      } else {
        fromValue = fromNode.getAttribute(attrName);
        if (fromValue !== attrValue) {
          fromNode.setAttribute(attrName, attrValue);
        }
      }
    }
    var fromNodeAttrs = fromNode.attributes;
    for (var d = fromNodeAttrs.length - 1; d >= 0; d--) {
      attr = fromNodeAttrs[d];
      attrName = attr.name;
      attrNamespaceURI = attr.namespaceURI;
      if (attrNamespaceURI) {
        attrName = attr.localName || attrName;
        if (!toNode.hasAttributeNS(attrNamespaceURI, attrName)) {
          fromNode.removeAttributeNS(attrNamespaceURI, attrName);
        }
      } else {
        if (!toNode.hasAttribute(attrName)) {
          fromNode.removeAttribute(attrName);
        }
      }
    }
  }
  function createFragmentFromTemplate(str) {
    var template = doc.createElement("template");
    template.innerHTML = str;
    return template.content.childNodes[0];
  }
  function createFragmentFromRange(str) {
    if (!range) {
      range = doc.createRange();
      range.selectNode(doc.body);
    }
    var fragment = range.createContextualFragment(str);
    return fragment.childNodes[0];
  }
  function createFragmentFromWrap(str) {
    var fragment = doc.createElement("body");
    fragment.innerHTML = str;
    return fragment.childNodes[0];
  }
  function toElement(str) {
    str = str.trim();
    if (HAS_TEMPLATE_SUPPORT) {
      return createFragmentFromTemplate(str);
    } else if (HAS_RANGE_SUPPORT) {
      return createFragmentFromRange(str);
    }
    return createFragmentFromWrap(str);
  }
  function compareNodeNames(fromEl, toEl) {
    var fromNodeName = fromEl.nodeName;
    var toNodeName = toEl.nodeName;
    var fromCodeStart, toCodeStart;
    if (fromNodeName === toNodeName) {
      return true;
    }
    fromCodeStart = fromNodeName.charCodeAt(0);
    toCodeStart = toNodeName.charCodeAt(0);
    if (fromCodeStart <= 90 && toCodeStart >= 97) {
      return fromNodeName === toNodeName.toUpperCase();
    } else if (toCodeStart <= 90 && fromCodeStart >= 97) {
      return toNodeName === fromNodeName.toUpperCase();
    } else {
      return false;
    }
  }
  function createElementNS(name, namespaceURI) {
    return !namespaceURI || namespaceURI === NS_XHTML ? doc.createElement(name) : doc.createElementNS(namespaceURI, name);
  }
  function moveChildren(fromEl, toEl) {
    var curChild = fromEl.firstChild;
    while (curChild) {
      var nextChild = curChild.nextSibling;
      toEl.appendChild(curChild);
      curChild = nextChild;
    }
    return toEl;
  }
  function syncBooleanAttrProp(fromEl, toEl, name) {
    if (fromEl[name] !== toEl[name]) {
      fromEl[name] = toEl[name];
      if (fromEl[name]) {
        fromEl.setAttribute(name, "");
      } else {
        fromEl.removeAttribute(name);
      }
    }
  }
  function noop() {
  }
  function defaultGetNodeKey(node) {
    if (node) {
      return node.getAttribute && node.getAttribute("id") || node.id;
    }
  }
  function morphdomFactory(morphAttrs2) {
    return function morphdom2(fromNode, toNode, options2) {
      if (!options2) {
        options2 = {};
      }
      if (typeof toNode === "string") {
        if (fromNode.nodeName === "#document" || fromNode.nodeName === "HTML") {
          var toNodeHtml = toNode;
          toNode = doc.createElement("html");
          toNode.innerHTML = toNodeHtml;
        } else if (fromNode.nodeName === "BODY") {
          var toNodeBody = toNode;
          toNode = doc.createElement("html");
          toNode.innerHTML = toNodeBody;
          var bodyElement = toNode.querySelector("body");
          if (bodyElement) {
            toNode = bodyElement;
          }
        } else {
          toNode = toElement(toNode);
        }
      } else if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
        toNode = toNode.firstElementChild;
      }
      var getNodeKey = options2.getNodeKey || defaultGetNodeKey;
      var onBeforeNodeAdded = options2.onBeforeNodeAdded || noop;
      var onNodeAdded = options2.onNodeAdded || noop;
      var onBeforeElUpdated = options2.onBeforeElUpdated || noop;
      var onElUpdated = options2.onElUpdated || noop;
      var onBeforeNodeDiscarded = options2.onBeforeNodeDiscarded || noop;
      var onNodeDiscarded = options2.onNodeDiscarded || noop;
      var onBeforeElChildrenUpdated = options2.onBeforeElChildrenUpdated || noop;
      var skipFromChildren = options2.skipFromChildren || noop;
      var addChild = options2.addChild || function(parent, child) {
        return parent.appendChild(child);
      };
      var childrenOnly = options2.childrenOnly === true;
      var fromNodesLookup = /* @__PURE__ */ Object.create(null);
      var keyedRemovalList = [];
      function addKeyedRemoval(key) {
        keyedRemovalList.push(key);
      }
      function walkDiscardedChildNodes(node, skipKeyedNodes) {
        if (node.nodeType === ELEMENT_NODE) {
          var curChild = node.firstChild;
          while (curChild) {
            var key = void 0;
            if (skipKeyedNodes && (key = getNodeKey(curChild))) {
              addKeyedRemoval(key);
            } else {
              onNodeDiscarded(curChild);
              if (curChild.firstChild) {
                walkDiscardedChildNodes(curChild, skipKeyedNodes);
              }
            }
            curChild = curChild.nextSibling;
          }
        }
      }
      function removeNode(node, parentNode, skipKeyedNodes) {
        if (onBeforeNodeDiscarded(node) === false) {
          return;
        }
        if (parentNode) {
          parentNode.removeChild(node);
        }
        onNodeDiscarded(node);
        walkDiscardedChildNodes(node, skipKeyedNodes);
      }
      function indexTree(node) {
        if (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
          var curChild = node.firstChild;
          while (curChild) {
            var key = getNodeKey(curChild);
            if (key) {
              fromNodesLookup[key] = curChild;
            }
            indexTree(curChild);
            curChild = curChild.nextSibling;
          }
        }
      }
      indexTree(fromNode);
      function handleNodeAdded(el) {
        onNodeAdded(el);
        var curChild = el.firstChild;
        while (curChild) {
          var nextSibling = curChild.nextSibling;
          var key = getNodeKey(curChild);
          if (key) {
            var unmatchedFromEl = fromNodesLookup[key];
            if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
              curChild.parentNode.replaceChild(unmatchedFromEl, curChild);
              morphEl(unmatchedFromEl, curChild);
            } else {
              handleNodeAdded(curChild);
            }
          } else {
            handleNodeAdded(curChild);
          }
          curChild = nextSibling;
        }
      }
      function cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey) {
        while (curFromNodeChild) {
          var fromNextSibling = curFromNodeChild.nextSibling;
          if (curFromNodeKey = getNodeKey(curFromNodeChild)) {
            addKeyedRemoval(curFromNodeKey);
          } else {
            removeNode(
              curFromNodeChild,
              fromEl,
              true
              /* skip keyed nodes */
            );
          }
          curFromNodeChild = fromNextSibling;
        }
      }
      function morphEl(fromEl, toEl, childrenOnly2) {
        var toElKey = getNodeKey(toEl);
        if (toElKey) {
          delete fromNodesLookup[toElKey];
        }
        if (!childrenOnly2) {
          var beforeUpdateResult = onBeforeElUpdated(fromEl, toEl);
          if (beforeUpdateResult === false) {
            return;
          } else if (beforeUpdateResult instanceof HTMLElement) {
            fromEl = beforeUpdateResult;
            indexTree(fromEl);
          }
          morphAttrs2(fromEl, toEl);
          onElUpdated(fromEl);
          if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
            return;
          }
        }
        if (fromEl.nodeName !== "TEXTAREA") {
          morphChildren(fromEl, toEl);
        } else {
          specialElHandlers.TEXTAREA(fromEl, toEl);
        }
      }
      function morphChildren(fromEl, toEl) {
        var skipFrom = skipFromChildren(fromEl, toEl);
        var curToNodeChild = toEl.firstChild;
        var curFromNodeChild = fromEl.firstChild;
        var curToNodeKey;
        var curFromNodeKey;
        var fromNextSibling;
        var toNextSibling;
        var matchingFromEl;
        outer: while (curToNodeChild) {
          toNextSibling = curToNodeChild.nextSibling;
          curToNodeKey = getNodeKey(curToNodeChild);
          while (!skipFrom && curFromNodeChild) {
            fromNextSibling = curFromNodeChild.nextSibling;
            if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
              curToNodeChild = toNextSibling;
              curFromNodeChild = fromNextSibling;
              continue outer;
            }
            curFromNodeKey = getNodeKey(curFromNodeChild);
            var curFromNodeType = curFromNodeChild.nodeType;
            var isCompatible = void 0;
            if (curFromNodeType === curToNodeChild.nodeType) {
              if (curFromNodeType === ELEMENT_NODE) {
                if (curToNodeKey) {
                  if (curToNodeKey !== curFromNodeKey) {
                    if (matchingFromEl = fromNodesLookup[curToNodeKey]) {
                      if (fromNextSibling === matchingFromEl) {
                        isCompatible = false;
                      } else {
                        fromEl.insertBefore(matchingFromEl, curFromNodeChild);
                        if (curFromNodeKey) {
                          addKeyedRemoval(curFromNodeKey);
                        } else {
                          removeNode(
                            curFromNodeChild,
                            fromEl,
                            true
                            /* skip keyed nodes */
                          );
                        }
                        curFromNodeChild = matchingFromEl;
                        curFromNodeKey = getNodeKey(curFromNodeChild);
                      }
                    } else {
                      isCompatible = false;
                    }
                  }
                } else if (curFromNodeKey) {
                  isCompatible = false;
                }
                isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild);
                if (isCompatible) {
                  morphEl(curFromNodeChild, curToNodeChild);
                }
              } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
                isCompatible = true;
                if (curFromNodeChild.nodeValue !== curToNodeChild.nodeValue) {
                  curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
                }
              }
            }
            if (isCompatible) {
              curToNodeChild = toNextSibling;
              curFromNodeChild = fromNextSibling;
              continue outer;
            }
            if (curFromNodeKey) {
              addKeyedRemoval(curFromNodeKey);
            } else {
              removeNode(
                curFromNodeChild,
                fromEl,
                true
                /* skip keyed nodes */
              );
            }
            curFromNodeChild = fromNextSibling;
          }
          if (curToNodeKey && (matchingFromEl = fromNodesLookup[curToNodeKey]) && compareNodeNames(matchingFromEl, curToNodeChild)) {
            if (!skipFrom) {
              addChild(fromEl, matchingFromEl);
            }
            morphEl(matchingFromEl, curToNodeChild);
          } else {
            var onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild);
            if (onBeforeNodeAddedResult !== false) {
              if (onBeforeNodeAddedResult) {
                curToNodeChild = onBeforeNodeAddedResult;
              }
              if (curToNodeChild.actualize) {
                curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc);
              }
              addChild(fromEl, curToNodeChild);
              handleNodeAdded(curToNodeChild);
            }
          }
          curToNodeChild = toNextSibling;
          curFromNodeChild = fromNextSibling;
        }
        cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey);
        var specialElHandler = specialElHandlers[fromEl.nodeName];
        if (specialElHandler) {
          specialElHandler(fromEl, toEl);
        }
      }
      var morphedNode = fromNode;
      var morphedNodeType = morphedNode.nodeType;
      var toNodeType = toNode.nodeType;
      if (!childrenOnly) {
        if (morphedNodeType === ELEMENT_NODE) {
          if (toNodeType === ELEMENT_NODE) {
            if (!compareNodeNames(fromNode, toNode)) {
              onNodeDiscarded(fromNode);
              morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
            }
          } else {
            morphedNode = toNode;
          }
        } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) {
          if (toNodeType === morphedNodeType) {
            if (morphedNode.nodeValue !== toNode.nodeValue) {
              morphedNode.nodeValue = toNode.nodeValue;
            }
            return morphedNode;
          } else {
            morphedNode = toNode;
          }
        }
      }
      if (morphedNode === toNode) {
        onNodeDiscarded(fromNode);
      } else {
        if (toNode.isSameNode && toNode.isSameNode(morphedNode)) {
          return;
        }
        morphEl(morphedNode, toNode, childrenOnly);
        if (keyedRemovalList) {
          for (var i = 0, len = keyedRemovalList.length; i < len; i++) {
            var elToRemove = fromNodesLookup[keyedRemovalList[i]];
            if (elToRemove) {
              removeNode(elToRemove, elToRemove.parentNode, false);
            }
          }
        }
      }
      if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
        if (morphedNode.actualize) {
          morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc);
        }
        fromNode.parentNode.replaceChild(morphedNode, fromNode);
      }
      return morphedNode;
    };
  }
  var DOCUMENT_FRAGMENT_NODE, range, NS_XHTML, doc, HAS_TEMPLATE_SUPPORT, HAS_RANGE_SUPPORT, specialElHandlers, ELEMENT_NODE, DOCUMENT_FRAGMENT_NODE$1, TEXT_NODE, COMMENT_NODE, morphdom, morphdom_esm_default;
  var init_morphdom_esm = __esm({
    "node_modules/morphdom/dist/morphdom-esm.js"() {
      DOCUMENT_FRAGMENT_NODE = 11;
      NS_XHTML = "http://www.w3.org/1999/xhtml";
      doc = typeof document === "undefined" ? void 0 : document;
      HAS_TEMPLATE_SUPPORT = !!doc && "content" in doc.createElement("template");
      HAS_RANGE_SUPPORT = !!doc && doc.createRange && "createContextualFragment" in doc.createRange();
      specialElHandlers = {
        OPTION: function(fromEl, toEl) {
          var parentNode = fromEl.parentNode;
          if (parentNode) {
            var parentName = parentNode.nodeName.toUpperCase();
            if (parentName === "OPTGROUP") {
              parentNode = parentNode.parentNode;
              parentName = parentNode && parentNode.nodeName.toUpperCase();
            }
            if (parentName === "SELECT" && !parentNode.hasAttribute("multiple")) {
              if (fromEl.hasAttribute("selected") && !toEl.selected) {
                fromEl.setAttribute("selected", "selected");
                fromEl.removeAttribute("selected");
              }
              parentNode.selectedIndex = -1;
            }
          }
          syncBooleanAttrProp(fromEl, toEl, "selected");
        },
        /**
         * The "value" attribute is special for the <input> element since it sets
         * the initial value. Changing the "value" attribute without changing the
         * "value" property will have no effect since it is only used to the set the
         * initial value.  Similar for the "checked" attribute, and "disabled".
         */
        INPUT: function(fromEl, toEl) {
          syncBooleanAttrProp(fromEl, toEl, "checked");
          syncBooleanAttrProp(fromEl, toEl, "disabled");
          if (fromEl.value !== toEl.value) {
            fromEl.value = toEl.value;
          }
          if (!toEl.hasAttribute("value")) {
            fromEl.removeAttribute("value");
          }
        },
        TEXTAREA: function(fromEl, toEl) {
          var newValue = toEl.value;
          if (fromEl.value !== newValue) {
            fromEl.value = newValue;
          }
          var firstChild = fromEl.firstChild;
          if (firstChild) {
            var oldValue = firstChild.nodeValue;
            if (oldValue == newValue || !newValue && oldValue == fromEl.placeholder) {
              return;
            }
            firstChild.nodeValue = newValue;
          }
        },
        SELECT: function(fromEl, toEl) {
          if (!toEl.hasAttribute("multiple")) {
            var selectedIndex = -1;
            var i = 0;
            var curChild = fromEl.firstChild;
            var optgroup;
            var nodeName;
            while (curChild) {
              nodeName = curChild.nodeName && curChild.nodeName.toUpperCase();
              if (nodeName === "OPTGROUP") {
                optgroup = curChild;
                curChild = optgroup.firstChild;
                if (!curChild) {
                  curChild = optgroup.nextSibling;
                  optgroup = null;
                }
              } else {
                if (nodeName === "OPTION") {
                  if (curChild.hasAttribute("selected")) {
                    selectedIndex = i;
                    break;
                  }
                  i++;
                }
                curChild = curChild.nextSibling;
                if (!curChild && optgroup) {
                  curChild = optgroup.nextSibling;
                  optgroup = null;
                }
              }
            }
            fromEl.selectedIndex = selectedIndex;
          }
        }
      };
      ELEMENT_NODE = 1;
      DOCUMENT_FRAGMENT_NODE$1 = 11;
      TEXT_NODE = 3;
      COMMENT_NODE = 8;
      morphdom = morphdomFactory(morphAttrs);
      morphdom_esm_default = morphdom;
    }
  });

  // src/renderer/shared/rich-content/unistudy-content-pipeline.js
  function noop2(value) {
    return value;
  }
  function createMapPlaceholderReplacer(map) {
    if (!map || map.size === 0) {
      return noop2;
    }
    return (text2) => {
      let result = text2;
      for (const [placeholder, original] of map.entries()) {
        if (result.includes(placeholder)) {
          result = result.replace(placeholder, () => original);
        }
      }
      return result;
    };
  }
  function createContentPipeline(deps = {}) {
    const {
      escapeHtml = (text2) => text2,
      processStartEndMarkers = (text2) => text2,
      fixEmoticonUrlsInMarkdown = (text2) => text2,
      deIndentMisinterpretedCodeBlocks = (text2) => text2,
      deIndentHtml = (text2) => text2,
      deIndentToolRequestBlocks = (text2) => text2,
      applyContentProcessors = (text2) => text2,
      transformSpecialBlocks = (text2) => text2,
      ensureHtmlFenced = (text2) => text2,
      transformMermaidPlaceholders = (text2) => text2,
      getToolResultRegex = null,
      getCodeFenceRegex = null,
      getDesktopPushRegex = null,
      getDesktopPushPartialRegex = null
    } = deps;
    function createContext(inputText, options2 = {}) {
      return {
        mode: options2.mode || PIPELINE_MODES.FULL_RENDER,
        text: typeof inputText === "string" ? inputText : "",
        options: options2,
        meta: {
          stepsApplied: []
        },
        state: {
          toolResultMap: null,
          codeBlockMap: null,
          toolResultPlaceholderId: 0,
          codeBlockPlaceholderId: 0
        }
      };
    }
    function step(ctx, name, handler) {
      ctx.text = handler(ctx.text, ctx) ?? ctx.text;
      ctx.meta.stepsApplied.push(name);
      return ctx;
    }
    function protectToolResults(text2, ctx) {
      const toolResultRegex = typeof getToolResultRegex === "function" ? getToolResultRegex() : null;
      if (!toolResultRegex) return text2;
      toolResultRegex.lastIndex = 0;
      const hasToolResults = toolResultRegex.test(text2);
      toolResultRegex.lastIndex = 0;
      if (!hasToolResults) return text2;
      ctx.state.toolResultMap = /* @__PURE__ */ new Map();
      const result = text2.replace(toolResultRegex, (match) => {
        const placeholder = `<!--UNISTUDY_TOOL_RESULT_${ctx.state.toolResultPlaceholderId}-->`;
        ctx.state.toolResultMap.set(placeholder, match);
        ctx.state.toolResultPlaceholderId += 1;
        return placeholder;
      });
      toolResultRegex.lastIndex = 0;
      return result;
    }
    function protectCodeBlocks(text2, ctx) {
      const codeFenceRegex = typeof getCodeFenceRegex === "function" ? getCodeFenceRegex() : null;
      if (!codeFenceRegex || !/```/.test(text2)) return text2;
      ctx.state.codeBlockMap = /* @__PURE__ */ new Map();
      return text2.replace(codeFenceRegex, (match) => {
        const placeholder = `__CODE_BLOCK_PLACEHOLDER_${ctx.state.codeBlockPlaceholderId}__`;
        ctx.state.codeBlockMap.set(placeholder, match);
        ctx.state.codeBlockPlaceholderId += 1;
        return placeholder;
      });
    }
    function restoreCodeBlocks(text2, ctx) {
      return createMapPlaceholderReplacer(ctx.state.codeBlockMap)(text2);
    }
    function transformDesktopPush(text2, ctx) {
      const desktopPushRegex = typeof getDesktopPushRegex === "function" ? getDesktopPushRegex() : null;
      const desktopPushPartialRegex = typeof getDesktopPushPartialRegex === "function" ? getDesktopPushPartialRegex() : null;
      if (!desktopPushRegex || !desktopPushPartialRegex) return text2;
      desktopPushRegex.lastIndex = 0;
      desktopPushPartialRegex.lastIndex = 0;
      let result = text2.replace(desktopPushRegex, (match, rawContent) => {
        const content = rawContent.trim();
        const escapedPreview = escapeHtml(content.length > 120 ? content.substring(0, 120) + "..." : content);
        return `<div class="unistudy-desktop-push-placeholder"><div class="unistudy-desktop-push-header"><span class="unistudy-desktop-push-icon">\u{1F5A5}\uFE0F</span><span class="unistudy-desktop-push-label">\u5DF2\u63A8\u9001\u5230\u684C\u9762\u753B\u5E03</span></div><div class="unistudy-desktop-push-preview"><pre>${escapedPreview}</pre></div></div>`;
      });
      result = result.replace(desktopPushPartialRegex, (match, partialContent) => {
        const content = partialContent.trim();
        const lines = content.split("\n");
        const totalLines = lines.length;
        const tailLines = lines.slice(-3).join("\n");
        const escapedPreview = escapeHtml(tailLines.length > 120 ? tailLines.substring(tailLines.length - 120) : tailLines);
        const lineCountInfo = totalLines > 3 ? `(${totalLines} \u884C)` : "";
        return `<div class="unistudy-desktop-push-placeholder constructing"><div class="unistudy-desktop-push-header"><span class="unistudy-desktop-push-icon">\u{1F5A5}\uFE0F</span><span class="unistudy-desktop-push-label">\u6B63\u5728\u5411\u684C\u9762\u63A8\u9001 ${escapeHtml(lineCountInfo)}<span class="thinking-indicator-dots">...</span></span></div><div class="unistudy-desktop-push-preview"><pre>${escapedPreview}</pre></div></div>`;
      });
      desktopPushRegex.lastIndex = 0;
      desktopPushPartialRegex.lastIndex = 0;
      return result;
    }
    function runFullRenderPipeline(inputText, options2 = {}) {
      const ctx = createContext(inputText, { ...options2, mode: PIPELINE_MODES.FULL_RENDER });
      step(ctx, "normalize-emoticon-urls", (text2) => fixEmoticonUrlsInMarkdown(text2));
      step(ctx, "protect-tool-results", protectToolResults);
      step(ctx, "escape-start-end-markers", (text2) => processStartEndMarkers(text2));
      step(ctx, "transform-mermaid-placeholders", (text2) => transformMermaidPlaceholders(text2));
      step(ctx, "protect-code-blocks", protectCodeBlocks);
      step(ctx, "deindent-misinterpreted-code-blocks", (text2) => deIndentMisinterpretedCodeBlocks(text2));
      step(ctx, "deindent-html", (text2) => deIndentHtml(text2));
      step(ctx, "deindent-tool-request-blocks", (text2) => deIndentToolRequestBlocks(text2));
      step(ctx, "transform-desktop-push", transformDesktopPush);
      step(ctx, "transform-special-blocks", (text2) => transformSpecialBlocks(text2, ctx.state.codeBlockMap));
      step(ctx, "ensure-html-fenced", (text2) => ensureHtmlFenced(text2));
      step(ctx, "apply-common-content-processors", (text2) => applyContentProcessors(text2));
      step(ctx, "restore-code-blocks", restoreCodeBlocks);
      return {
        text: ctx.text,
        meta: ctx.meta,
        state: ctx.state
      };
    }
    function runStreamFastPipeline(inputText, options2 = {}) {
      const ctx = createContext(inputText, { ...options2, mode: PIPELINE_MODES.STREAM_FAST });
      step(ctx, "normalize-emoticon-urls", (text2) => fixEmoticonUrlsInMarkdown(text2));
      step(ctx, "deindent-misinterpreted-code-blocks", (text2) => deIndentMisinterpretedCodeBlocks(text2));
      step(ctx, "escape-start-end-markers", (text2) => processStartEndMarkers(text2));
      step(ctx, "apply-common-content-processors", (text2) => applyContentProcessors(text2));
      return {
        text: ctx.text,
        meta: ctx.meta,
        state: ctx.state
      };
    }
    function process(inputText, options2 = {}) {
      const mode = options2.mode || PIPELINE_MODES.FULL_RENDER;
      if (mode === PIPELINE_MODES.STREAM_FAST) {
        return runStreamFastPipeline(inputText, options2);
      }
      return runFullRenderPipeline(inputText, options2);
    }
    return {
      process,
      runFullRenderPipeline,
      runStreamFastPipeline
    };
  }
  var PIPELINE_MODES;
  var init_unistudy_content_pipeline = __esm({
    "src/renderer/shared/rich-content/unistudy-content-pipeline.js"() {
      PIPELINE_MODES = {
        FULL_RENDER: "full-render",
        STREAM_FAST: "stream-fast"
      };
    }
  });

  // src/renderer/shared/rich-content/unistudy-scoped-css.js
  function stripCssComments(cssString) {
    if (typeof cssString !== "string" || !cssString) {
      return "";
    }
    let result = "";
    let quote = null;
    for (let index = 0; index < cssString.length; index += 1) {
      const char = cssString[index];
      const nextChar = cssString[index + 1];
      if (quote) {
        result += char;
        if (char === "\\" && index + 1 < cssString.length) {
          result += cssString[index + 1];
          index += 1;
          continue;
        }
        if (char === quote) {
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        result += char;
        continue;
      }
      if (char === "/" && nextChar === "*") {
        index += 2;
        while (index < cssString.length && !(cssString[index] === "*" && cssString[index + 1] === "/")) {
          index += 1;
        }
        index += 1;
        continue;
      }
      result += char;
    }
    return result;
  }
  function splitTopLevel(input, separatorChar) {
    const items = [];
    let current = "";
    let quote = null;
    let bracketDepth = 0;
    let parenDepth = 0;
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (quote) {
        current += char;
        if (char === "\\" && index + 1 < input.length) {
          current += input[index + 1];
          index += 1;
          continue;
        }
        if (char === quote) {
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        current += char;
        continue;
      }
      if (char === "[") {
        bracketDepth += 1;
        current += char;
        continue;
      }
      if (char === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
        current += char;
        continue;
      }
      if (char === "(") {
        parenDepth += 1;
        current += char;
        continue;
      }
      if (char === ")") {
        parenDepth = Math.max(0, parenDepth - 1);
        current += char;
        continue;
      }
      if (char === separatorChar && bracketDepth === 0 && parenDepth === 0) {
        items.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    items.push(current);
    return items;
  }
  function findMatchingBrace(cssText, openBraceIndex) {
    let depth = 1;
    let quote = null;
    let bracketDepth = 0;
    let parenDepth = 0;
    for (let index = openBraceIndex + 1; index < cssText.length; index += 1) {
      const char = cssText[index];
      const nextChar = cssText[index + 1];
      if (quote) {
        if (char === "\\" && index + 1 < cssText.length) {
          index += 1;
          continue;
        }
        if (char === quote) {
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === "/" && nextChar === "*") {
        index += 2;
        while (index < cssText.length && !(cssText[index] === "*" && cssText[index + 1] === "/")) {
          index += 1;
        }
        index += 1;
        continue;
      }
      if (char === "[") {
        bracketDepth += 1;
        continue;
      }
      if (char === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
        continue;
      }
      if (char === "(") {
        parenDepth += 1;
        continue;
      }
      if (char === ")") {
        parenDepth = Math.max(0, parenDepth - 1);
        continue;
      }
      if (bracketDepth > 0 || parenDepth > 0) {
        continue;
      }
      if (char === "{") {
        depth += 1;
        continue;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
    }
    return cssText.length - 1;
  }
  function splitSelectorSegments(selector) {
    const segments = [];
    let current = "";
    let pendingCombinator = null;
    let quote = null;
    let bracketDepth = 0;
    let parenDepth = 0;
    function flushCurrent() {
      const trimmed = current.trim();
      if (!trimmed) {
        current = "";
        return;
      }
      segments.push({
        combinator: segments.length === 0 ? null : pendingCombinator || " ",
        compound: trimmed
      });
      current = "";
      pendingCombinator = null;
    }
    for (let index = 0; index < selector.length; index += 1) {
      const char = selector[index];
      if (quote) {
        current += char;
        if (char === "\\" && index + 1 < selector.length) {
          current += selector[index + 1];
          index += 1;
          continue;
        }
        if (char === quote) {
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        current += char;
        continue;
      }
      if (char === "[") {
        bracketDepth += 1;
        current += char;
        continue;
      }
      if (char === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
        current += char;
        continue;
      }
      if (char === "(") {
        parenDepth += 1;
        current += char;
        continue;
      }
      if (char === ")") {
        parenDepth = Math.max(0, parenDepth - 1);
        current += char;
        continue;
      }
      if (bracketDepth === 0 && parenDepth === 0) {
        if (/\s/.test(char)) {
          flushCurrent();
          let lookahead = index;
          while (lookahead + 1 < selector.length && /\s/.test(selector[lookahead + 1])) {
            lookahead += 1;
          }
          const nextChar = selector[lookahead + 1];
          if (segments.length > 0 && nextChar && ![">", "+", "~"].includes(nextChar)) {
            pendingCombinator = " ";
          }
          index = lookahead;
          continue;
        }
        if (char === ">" || char === "+" || char === "~") {
          flushCurrent();
          pendingCombinator = char;
          while (index + 1 < selector.length && /\s/.test(selector[index + 1])) {
            index += 1;
          }
          continue;
        }
      }
      current += char;
    }
    flushCurrent();
    return segments;
  }
  function normalizeCompound(compound) {
    const trimmed = String(compound || "").trim();
    if (!trimmed || trimmed === "*") {
      return {
        compound: trimmed,
        attachToRoot: false
      };
    }
    let normalized = trimmed;
    let previous = null;
    let attachToRoot = false;
    while (normalized && normalized !== previous) {
      previous = normalized;
      if (ROOT_PREFIX_REGEX.test(normalized)) {
        attachToRoot = true;
      }
      normalized = normalized.replace(ROOT_PREFIX_REGEX, "").trim();
    }
    return {
      compound: normalized,
      attachToRoot
    };
  }
  function rebuildSelector(segments) {
    return segments.reduce((result, segment, index) => {
      if (index === 0 || !segment.combinator) {
        return `${result}${segment.compound}`;
      }
      if (segment.combinator === " ") {
        return `${result} ${segment.compound}`;
      }
      return `${result} ${segment.combinator} ${segment.compound}`;
    }, "");
  }
  function scopeSelector(selector, scopeId) {
    const trimmed = String(selector || "").trim();
    if (!trimmed) {
      return `#${scopeId}`;
    }
    const normalizedSegments = splitSelectorSegments(trimmed).map((segment) => ({
      ...segment,
      ...normalizeCompound(segment.compound)
    })).filter((segment) => segment.compound);
    if (normalizedSegments.length === 0) {
      return `#${scopeId}`;
    }
    const normalizedSelector = rebuildSelector(normalizedSegments);
    if (!normalizedSelector || normalizedSelector === "*") {
      return `#${scopeId} *`;
    }
    if (normalizedSegments[0]?.attachToRoot && /^[#.:\[]/.test(normalizedSelector)) {
      return `#${scopeId}${normalizedSelector}`;
    }
    if (normalizedSelector.startsWith(":")) {
      return `#${scopeId}${normalizedSelector}`;
    }
    return `#${scopeId} ${normalizedSelector}`;
  }
  function scopeStyleRule(prelude, body, scopeId) {
    const scopedSelectors = splitTopLevel(prelude, ",").map((selector) => scopeSelector(selector, scopeId)).filter(Boolean).join(", ");
    if (!scopedSelectors) {
      return "";
    }
    return `${scopedSelectors} { ${body.trim()} }`;
  }
  function scopeNestedCss(cssString, scopeId) {
    const cssText = stripCssComments(cssString);
    const statements = [];
    let index = 0;
    while (index < cssText.length) {
      while (index < cssText.length && /\s/.test(cssText[index])) {
        index += 1;
      }
      if (index >= cssText.length) {
        break;
      }
      let prelude = "";
      let quote = null;
      let bracketDepth = 0;
      let parenDepth = 0;
      let cursor = index;
      for (; cursor < cssText.length; cursor += 1) {
        const char = cssText[cursor];
        const nextChar = cssText[cursor + 1];
        if (quote) {
          prelude += char;
          if (char === "\\" && cursor + 1 < cssText.length) {
            prelude += cssText[cursor + 1];
            cursor += 1;
            continue;
          }
          if (char === quote) {
            quote = null;
          }
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          prelude += char;
          continue;
        }
        if (char === "/" && nextChar === "*") {
          cursor += 2;
          while (cursor < cssText.length && !(cssText[cursor] === "*" && cssText[cursor + 1] === "/")) {
            cursor += 1;
          }
          cursor += 1;
          continue;
        }
        if (char === "[") {
          bracketDepth += 1;
          prelude += char;
          continue;
        }
        if (char === "]") {
          bracketDepth = Math.max(0, bracketDepth - 1);
          prelude += char;
          continue;
        }
        if (char === "(") {
          parenDepth += 1;
          prelude += char;
          continue;
        }
        if (char === ")") {
          parenDepth = Math.max(0, parenDepth - 1);
          prelude += char;
          continue;
        }
        if (bracketDepth === 0 && parenDepth === 0 && (char === "{" || char === ";")) {
          break;
        }
        prelude += char;
      }
      const trimmedPrelude = prelude.trim();
      if (!trimmedPrelude) {
        index = cursor + 1;
        continue;
      }
      if (cursor >= cssText.length) {
        break;
      }
      if (cssText[cursor] === ";") {
        index = cursor + 1;
        continue;
      }
      const blockStart = cursor;
      const blockEnd = findMatchingBrace(cssText, blockStart);
      const body = cssText.slice(blockStart + 1, blockEnd);
      const atRuleName = trimmedPrelude.startsWith("@") ? trimmedPrelude.match(/^@[a-z-]+/i)?.[0]?.toLowerCase() || "" : "";
      let nextStatement = "";
      if (!atRuleName) {
        nextStatement = scopeStyleRule(trimmedPrelude, body, scopeId);
      } else if (BLOCKED_BLOCK_AT_RULES.has(atRuleName)) {
        nextStatement = "";
      } else if (PASSTHROUGH_BLOCK_AT_RULES.has(atRuleName)) {
        nextStatement = `${trimmedPrelude} { ${body.trim()} }`;
      } else {
        const scopedBody = scopeNestedCss(body, scopeId);
        nextStatement = scopedBody ? `${trimmedPrelude} { ${scopedBody} }` : "";
      }
      if (nextStatement) {
        statements.push(nextStatement);
      }
      index = blockEnd + 1;
    }
    return statements.join("\n");
  }
  function scopeCss(cssString, scopeId) {
    if (!scopeId) {
      throw new Error("scopeId is required to scope CSS.");
    }
    return scopeNestedCss(cssString, scopeId);
  }
  var ROOT_PREFIX_REGEX, BLOCKED_BLOCK_AT_RULES, PASSTHROUGH_BLOCK_AT_RULES;
  var init_unistudy_scoped_css = __esm({
    "src/renderer/shared/rich-content/unistudy-scoped-css.js"() {
      ROOT_PREFIX_REGEX = /^(?::root|html|body)(?=$|[#.:\[])/i;
      BLOCKED_BLOCK_AT_RULES = /* @__PURE__ */ new Set([
        "@font-face",
        "@page",
        "@property",
        "@counter-style",
        "@font-feature-values"
      ]);
      PASSTHROUGH_BLOCK_AT_RULES = /* @__PURE__ */ new Set([
        "@keyframes",
        "@-webkit-keyframes",
        "@-moz-keyframes",
        "@-o-keyframes"
      ]);
    }
  });

  // src/renderer/shared/rich-content/index.js
  var require_index = __commonJS({
    "src/renderer/shared/rich-content/index.js"() {
      init_purify_es();
      init_marked_esm();
      init_morphdom_esm();
      init_unistudy_content_pipeline();
      init_unistudy_scoped_css();
      var BLOCKED_TAGS = ["script", "style", "form", "iframe", "object", "embed", "meta", "link", "base", "video", "audio"];
      var SCRIPT_HOSTS = /* @__PURE__ */ new Set(["unpkg.com", "cdn.jsdelivr.net", "esm.sh"]);
      var LOCAL_THREE_URL = new URL("./three.min.js", document.currentScript?.src || window.location.href).href;
      var unistudyPipeline = createContentPipeline({
        // Retain UniStudy's protect → normalize → restore ordering while keeping
        // TsukuMate's renderer responsible for the final safe DOM construction.
        escapeHtml: (value) => String(value || "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]),
        deIndentMisinterpretedCodeBlocks: (value) => String(value || "").replace(/^\s+(```)/gm, "$1"),
        deIndentHtml: (value) => String(value || "").replace(/^\s+(?=<\/?(?:html|head|body|script|style)\b)/gmi, ""),
        ensureHtmlFenced: (value) => String(value || "").replace(/(^|\n)((?:<!doctype\s+html\b[^>]*>|<html\b[^>]*>)[\s\S]*?<\/html\s*>)/gi, (_all, prefix, document2) => `${prefix}\`\`\`html
${document2}
\`\`\``),
        getCodeFenceRegex: () => /```[\s\S]*?```/g
      });
      function prepareMessageContent(value, streaming = false) {
        return unistudyPipeline.process(String(value || ""), { mode: streaming ? PIPELINE_MODES.STREAM_FAST : PIPELINE_MODES.FULL_RENDER }).text;
      }
      function safeCss(value) {
        return String(value || "").replace(/@import[\s\S]*?;/gi, "").replace(/url\s*\([^)]*\)/gi, "none").replace(/expression\s*\([^)]*\)/gi, "");
      }
      function safeHtml(value) {
        const withInputActions = String(value || "").replace(/\s+onclick\s*=\s*(["'])\s*input\(\s*(["'])([\s\S]*?)\2\s*\)\s*\1/gi, (_all, _outer, _inner, reply) => ` data-tm-input="${String(reply).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}"`);
        return purify.sanitize(withInputActions, {
          FORBID_TAGS: BLOCKED_TAGS,
          FORBID_ATTR: ["src", "srcset", "href", "action", "formaction", "target"],
          ADD_ATTR: ["data-tm-input"],
          ALLOW_DATA_ATTR: false,
          ALLOW_ARIA_ATTR: true
        });
      }
      function extractTagContents(value, tag2) {
        const values = [];
        const expression = new RegExp(`<${tag2}\\b[^>]*>([\\s\\S]*?)<\\/${tag2}\\s*>`, "gi");
        const html3 = String(value || "").replace(expression, (_all, body) => {
          values.push(body);
          return "";
        });
        return { html: html3, values };
      }
      function safeRemoteScript(value) {
        try {
          const url = new URL(value);
          return url.protocol === "https:" && SCRIPT_HOSTS.has(url.hostname) ? url.href : "";
        } catch {
          return "";
        }
      }
      function extractScripts(value) {
        const scripts = [];
        const html3 = String(value || "").replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_all, attributes, body) => {
          const type = String(attributes.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1] || "").toLowerCase();
          if (type && !["module", "text/javascript", "application/javascript"].includes(type)) return "";
          const src = attributes.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
          if (src) {
            const safe = safeRemoteScript(src);
            if (safe) scripts.push({ src: safe, type });
          } else if (body.length <= 96e3) scripts.push({ code: body.replace(/<\/script/gi, "<\\/script"), type });
          return "";
        });
        return { html: html3, scripts };
      }
      function previewDocument(card) {
        const extracted = extractScripts(card.html);
        const styles = extractTagContents(extracted.html, "style");
        const html3 = safeHtml(styles.html);
        const css = safeCss([card.css, ...styles.values].filter(Boolean).join("\n"));
        const scripts = extracted.scripts.map((script) => script.src ? `<script${script.type === "module" ? ' type="module"' : ""} src="${script.src}"><\/script>` : `<script${script.type === "module" ? ' type="module"' : ""}>${script.code}<\/script>`).join("\n");
        return { html: html3, css, scripts, interactive: extracted.scripts.length > 0 };
      }
      function buildPreviewDocument(preview, frameId) {
        const bootstrap = `<script>(function(){const id=${JSON.stringify(frameId)};const report=(type,payload)=>parent.postMessage({type:'tsukumate-preview-'+type,frameId:id,...payload},'*');const resize=()=>{const root=document.documentElement;const height=Math.max(160,Math.ceil(Math.max(root.scrollHeight,document.body?document.body.scrollHeight:0)+2));report('resize',{height:Math.min(height,720)});};document.addEventListener('click',event=>{const button=event.target.closest?.('[data-tm-input]');if(!button)return;event.preventDefault();report('input',{value:button.getAttribute('data-tm-input')||''});});addEventListener('error',event=>report('status',{status:'error',message:String(event.message||'\u7F51\u9875\u8FD0\u884C\u51FA\u9519')}));addEventListener('unhandledrejection',event=>report('status',{status:'error',message:String(event.reason?.message||event.reason||'\u7F51\u9875\u8FD0\u884C\u51FA\u9519')}));addEventListener('load',()=>{report('status',{status:'ready',message:''});resize();setTimeout(resize,80);setTimeout(resize,500);});new ResizeObserver(resize).observe(document.documentElement);})();<\/script>`;
        return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://esm.sh; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"><style>html,body{margin:0;padding:0;background:transparent;color:#eef0f6;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}*{box-sizing:border-box}${preview.css}</style></head><body>${preview.html}${preview.scripts}${bootstrap}</body></html>`;
      }
      function isThreePreview(preview) {
        return /\bTHREE\.(?:WebGLRenderer|Scene|PerspectiveCamera|BoxGeometry|Mesh)\b|from\s*["'][^"']*three(?:\.module)?\.js/i.test(`${preview.html}
${preview.scripts}`);
      }
      function buildThreePreviewDocument(preview, frameId) {
        const script = preview.scripts.replace(/<script\b[^>]*>/gi, "").replace(/<\/script\s*>/gi, "").replace(/^\s*import\s+\*\s+as\s+THREE\s+from\s+["'][^"']*three(?:\.module)?\.js[^"']*["'];?\s*$/gmi, "").replace(/<\/script/gi, "<\\/script");
        const bootstrap = `<script>(function(){const id=${JSON.stringify(frameId)};const mount=document.getElementById('tm-three-mount')||document.body;const post=(type,payload)=>parent.postMessage({type:'tsukumate-preview-'+type,frameId:id,...payload},'*');const resize=()=>post('resize',{height:Math.min(720,Math.max(360,Math.ceil(Math.max(document.documentElement.scrollHeight,document.body.scrollHeight))) )});const append=document.body.appendChild.bind(document.body);document.body.appendChild=node=>node&&node.tagName==='CANVAS'?mount.appendChild(node):append(node);addEventListener('error',event=>post('status',{status:'error',message:String(event.message||'Three.js \u8FD0\u884C\u51FA\u9519')}));addEventListener('unhandledrejection',event=>post('status',{status:'error',message:String(event.reason?.message||event.reason||'Three.js \u8FD0\u884C\u51FA\u9519')}));addEventListener('load',()=>{if(!window.THREE){post('status',{status:'error',message:'\u672C\u5730 Three.js \u672A\u80FD\u52A0\u8F7D'});return;}post('status',{status:'ready',message:''});resize();setTimeout(resize,100);setTimeout(resize,550);});new ResizeObserver(resize).observe(document.documentElement);})();<\/script>`;
        return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' file:; connect-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"><style>html,body{margin:0;min-height:360px;background:#020617;color:#eef0f6;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}*{box-sizing:border-box}canvas{display:block;max-width:100%}${preview.css}</style></head><body>${preview.html}<div id="tm-three-mount"></div><script src="${LOCAL_THREE_URL}"><\/script>${bootstrap}<script>${script}<\/script></body></html>`;
      }
      function sourceText(card) {
        return `${card.css ? `<style>
${card.css}
</style>
` : ""}${card.html || ""}`;
      }
      function structuredDocument(value) {
        try {
          const parsed = JSON.parse(String(value || "").trim());
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
          const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
          const content = typeof parsed.content === "string" ? parsed.content.trim() : typeof parsed.text === "string" ? parsed.text.trim() : "";
          return title || content ? { title, content } : null;
        } catch {
          return null;
        }
      }
      function renderStructuredDocument(host, model, raw) {
        const shell = document.createElement("section");
        shell.className = "study-card-shell study-document-shell";
        const toolbar = document.createElement("div");
        toolbar.className = "study-card-toolbar";
        const status = document.createElement("span");
        status.className = "study-card-status";
        status.textContent = "\u5B66\u4E60\u6587\u6863";
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.textContent = "\u67E5\u770B\u6E90\u7801";
        const body = document.createElement("article");
        body.className = "study-document-body";
        if (model.title) {
          const heading2 = document.createElement("h3");
          heading2.textContent = model.title;
          body.append(heading2);
        }
        for (const paragraph2 of model.content.split(/\n{2,}|\\n{2,}/).map((item) => item.replace(/\\n/g, "\n").trim()).filter(Boolean)) {
          const item = document.createElement("p");
          item.textContent = paragraph2;
          body.append(item);
        }
        const source = document.createElement("pre");
        source.className = "study-card-source";
        source.hidden = true;
        source.textContent = raw;
        toggle.onclick = () => {
          const showingSource = source.hidden;
          source.hidden = !showingSource;
          body.hidden = showingSource;
          toggle.textContent = showingSource ? "\u8FD4\u56DE\u6587\u6863" : "\u67E5\u770B\u6E90\u7801";
        };
        toolbar.append(status, toggle);
        shell.append(toolbar, body, source);
        host.append(shell);
        return () => shell.remove();
      }
      function renderInlineFragment(host, raw) {
        const styles = extractTagContents(raw, "style");
        const shell = document.createElement("section");
        shell.className = "tm-inline-visual-fragment";
        const style = safeCss(styles.values.join("\n"));
        if (style) {
          const node = document.createElement("style");
          node.textContent = style;
          shell.append(node);
        }
        const content = document.createElement("div");
        content.className = "tm-inline-visual-content";
        content.innerHTML = safeHtml(styles.html);
        content.addEventListener("click", (event) => {
          const button = event.target.closest?.("[data-tm-input]");
          if (!button) return;
          event.preventDefault();
          window.TsukuMateRichContent?.onInput?.(button.getAttribute("data-tm-input") || "");
        });
        shell.append(content);
        host.append(shell);
        return () => shell.remove();
      }
      function splitStreamAtSafeBoundary(source, previousStableLength = 0) {
        const text2 = String(source || "");
        if (!text2) return { stableLength: 0, tail: "" };
        const candidates = [text2.lastIndexOf("\n\n"), text2.lastIndexOf("\n")].filter((index) => index >= previousStableLength);
        const stableLength = candidates.length ? Math.max(...candidates) + 1 : previousStableLength;
        return { stableLength: Math.min(stableLength, text2.length), tail: text2.slice(Math.min(stableLength, text2.length)) };
      }
      function scopedVisualStyles(source, scopeId) {
        const extracted = extractTagContents(source, "style");
        const css = safeCss(extracted.values.join("\n"));
        return { markup: extracted.html, css: css ? scopeCss(css, scopeId) : "" };
      }
      function installScopedStyle(state, css) {
        if (!css) return;
        if (!state.styleNode) {
          state.styleNode = document.createElement("style");
          state.styleNode.dataset.tmVisualScope = state.scopeId;
          document.head.append(state.styleNode);
        }
        if (state.styleNode.textContent !== css) state.styleNode.textContent = css;
      }
      function markdownHtml(source, state) {
        const visual = scopedVisualStyles(source, state.scopeId);
        installScopedStyle(state, visual.css);
        return safeHtml(marked.parse(visual.markup, { gfm: true, breaks: true }));
      }
      function preserveRuntimeNode(fromEl, toEl) {
        if (fromEl.isEqualNode(toEl)) return false;
        if (fromEl.matches?.("iframe, video:not([paused]), audio:not([paused]), canvas[data-tm-keep-alive]")) return false;
        if (fromEl === document.activeElement) queueMicrotask(() => fromEl.focus?.());
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(fromEl.tagName)) {
          toEl.value = fromEl.value;
          toEl.checked = fromEl.checked;
        }
        if (fromEl.tagName === "BUTTON" && fromEl.dataset.interacted === "true") {
          toEl.dataset.interacted = "true";
          toEl.setAttribute("aria-pressed", fromEl.getAttribute("aria-pressed") || "true");
        }
        return true;
      }
      function ensureStreamingRoots(host) {
        let stable = host.querySelector(":scope > .unistudy-stream-stable-root");
        let tail = host.querySelector(":scope > .unistudy-stream-tail-root");
        if (!stable || !tail) {
          host.replaceChildren();
          stable = document.createElement("div");
          stable.className = "unistudy-stream-stable-root visual-bubble-stable";
          tail = document.createElement("div");
          tail.className = "unistudy-stream-tail-root visual-bubble-tail";
          host.append(stable, tail);
        }
        return { stable, tail };
      }
      function renderVisualMessage(host, value, options2 = {}) {
        const state = host._tmVisualState || {
          scopeId: `tm-visual-${String(options2.messageId || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g, "")}`,
          stableLength: 0,
          stableSource: "",
          styleNode: null
        };
        host._tmVisualState = state;
        host.id = state.scopeId;
        host.classList.add("tm-unistudy-message-content");
        const source = prepareMessageContent(value, !!options2.streaming);
        const { stable, tail } = ensureStreamingRoots(host);
        if (!options2.streaming) {
          state.stableLength = source.length;
          state.stableSource = source;
          stable.innerHTML = markdownHtml(source, state);
          tail.replaceChildren();
          return () => cleanupVisualMessage(host);
        }
        const split = splitStreamAtSafeBoundary(source, state.stableLength);
        if (split.stableLength > state.stableLength) {
          state.stableSource = source.slice(0, split.stableLength);
          stable.innerHTML = markdownHtml(state.stableSource, state);
          state.stableLength = split.stableLength;
        }
        const tailSource = source.slice(state.stableLength);
        const next = document.createElement("div");
        next.innerHTML = markdownHtml(tailSource, state);
        try {
          morphdom_esm_default(tail, next, {
            childrenOnly: true,
            onBeforeElUpdated: preserveRuntimeNode,
            onNodeAdded(node) {
              if (node.nodeType === 1 && /^(P|DIV|UL|OL|LI|PRE|TABLE|H[1-6])$/.test(node.tagName)) node.classList.add("unistudy-stream-element-fade-in");
              return node;
            }
          });
        } catch {
        }
        return () => cleanupVisualMessage(host);
      }
      function cleanupVisualMessage(host) {
        const state = host?._tmVisualState;
        if (state?.styleNode) state.styleNode.remove();
        if (host) delete host._tmVisualState;
      }
      function renderCard(host, card) {
        const document2 = structuredDocument(card.html);
        if (document2) return renderStructuredDocument(host, document2, sourceText(card));
        const shell = document2.createElement("section");
        shell.className = "study-card-shell";
        const toolbar = document2.createElement("div");
        toolbar.className = "study-card-toolbar";
        const preview = previewDocument(card);
        const status = document2.createElement("span");
        status.className = "study-card-status";
        status.textContent = preview.interactive ? "\u6B63\u5728\u52A0\u8F7D\u4E92\u52A8\u7F51\u9875\u2026" : "\u6B63\u5728\u52A0\u8F7D\u7F51\u9875\u9884\u89C8\u2026";
        const toggle = document2.createElement("button");
        toggle.type = "button";
        toggle.textContent = "\u67E5\u770B\u6E90\u7801";
        const frame = document2.createElement("iframe");
        frame.className = "study-card-frame";
        frame.setAttribute("sandbox", "allow-scripts");
        frame.setAttribute("referrerpolicy", "no-referrer");
        frame.title = "AI \u751F\u6210\u7684\u5B66\u4E60\u5361\u7247";
        const source = document2.createElement("pre");
        source.className = "study-card-source";
        source.hidden = true;
        source.textContent = sourceText(card);
        const frameId = `tm-preview-${Math.random().toString(36).slice(2)}`;
        let timeout = setTimeout(() => {
          status.textContent = "\u9884\u89C8\u52A0\u8F7D\u8F83\u6162\uFF0C\u53EF\u67E5\u770B\u6E90\u7801";
          status.dataset.state = "error";
        }, 5e3);
        const markReady = () => {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          if (status.dataset.state !== "error") {
            status.dataset.state = "ready";
            status.textContent = preview.interactive ? "\u4E92\u52A8\u7F51\u9875\uFF08\u9694\u79BB\u8FD0\u884C\uFF09" : "\u7F51\u9875\u9884\u89C8";
          }
        };
        const onMessage = (event) => {
          if (event.source !== frame.contentWindow || event.data?.frameId !== frameId) return;
          if (event.data.type === "tsukumate-preview-resize" && Number.isFinite(event.data.height)) frame.style.height = `${Math.max(160, Math.min(720, event.data.height))}px`;
          if (event.data.type === "tsukumate-preview-status") {
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            const failed = event.data.status === "error";
            status.dataset.state = failed ? "error" : "ready";
            status.textContent = failed ? event.data.message || "\u7F51\u9875\u9884\u89C8\u8FD0\u884C\u51FA\u9519" : preview.interactive ? "\u4E92\u52A8\u7F51\u9875\uFF08\u9694\u79BB\u8FD0\u884C\uFF09" : "\u7F51\u9875\u9884\u89C8";
          }
          if (event.data.type === "tsukumate-preview-input") window.TsukuMateRichContent?.onInput?.(String(event.data.value || ""));
        };
        window.addEventListener("message", onMessage);
        frame.addEventListener("load", markReady, { once: true });
        frame.srcdoc = isThreePreview(preview) ? buildThreePreviewDocument(preview, frameId) : buildPreviewDocument(preview, frameId);
        toggle.addEventListener("click", () => {
          const showingSource = source.hidden;
          source.hidden = !showingSource;
          frame.hidden = showingSource;
          toggle.textContent = showingSource ? "\u8FD4\u56DE\u5361\u7247" : "\u67E5\u770B\u6E90\u7801";
        });
        toolbar.append(status, toggle);
        shell.append(toolbar, frame, source);
        host.appendChild(shell);
        return () => {
          if (timeout) clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          frame.srcdoc = "";
          shell.remove();
        };
      }
      window.TsukuMateRichContent = { renderCard, renderInlineFragment, renderVisualMessage, cleanupVisualMessage, safeCss, safeHtml, prepareMessageContent, onInput: null };
    }
  });
  require_index();
})();
/*! Bundled license information:

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.12 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.12/LICENSE *)
*/
