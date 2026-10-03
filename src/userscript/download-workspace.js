  const DOWNLOAD_TASKS = [];
  const DOWNLOAD_ALLOWED_HOSTS = ["bilivideo.com", "bilivideo.cn", "bilivideo.net", "edge.mountaintoys.cn"];
  const DOWNLOAD_ALLOWED_PORTS = new Set(["", "443", "4483"]);
  // BEGIN GENERATED BILIKIT REMUX WORKER
  // Worker 源码位于 src/remux.worker.js。
  // 以下内嵌字符串由 npm run build:remux-worker 生成，不要手动编辑。
  // 保留 Mediabunny 版本和 MPL-2.0 来源信息。
  const DOWNLOAD_JSON_TIMEOUT = 15000;
  function getDownloadJsonRequestApi() {
    if (typeof globalThis !== "undefined" && typeof globalThis.__BILIKIT_EDGE_GM_XMLHTTPREQUEST__ === "function") {
      return globalThis.__BILIKIT_EDGE_GM_XMLHTTPREQUEST__;
    }
    return typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : null;
  }
  function canDownloadRequestJson() {
    return typeof window !== "undefined" && typeof window.fetch === "function" || !!getDownloadJsonRequestApi();
  }
  function downloadRequestJsonViaGm(url, options = {}) {
    return new Promise((resolve, reject) => {
      const requestApi = getDownloadJsonRequestApi();
      if (!requestApi) {
        reject(new Error("跨域 JSON 请求 API 不可用"));
        return;
      }
      const signal = options.signal;
      const timeout = Math.max(1000, Number(options.timeout) || DOWNLOAD_JSON_TIMEOUT);
      let request = null;
      let timer = 0;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal?.removeEventListener?.("abort", onAbort);
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const fail = (message) => finish(reject, message instanceof Error ? message : new Error(String(message || "请求失败")));
      const onAbort = () => {
        try { request?.abort?.(); } catch {
        }
        fail(new Error("请求已取消"));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener?.("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        try { request?.abort?.(); } catch {
        }
        fail(new Error("请求超时"));
      }, timeout);
      try {
        request = requestApi({
          method: String(options.method || "GET").toUpperCase(),
          url: String(url),
          headers: { Accept: "application/json", ...(options.headers || {}) },
          responseType: "json",
          timeout,
          // Edge 扩展的 MAIN world 适配器用这个标记直接走 Service Worker，
          // 避免把未播放番剧的跨域播放请求再次交给页面 fetch。
          bilikitBridge: Boolean(options.bilikitBridge),
          onload: (response) => {
            let payload = response?.response;
            if ((!payload || typeof payload !== "object") && response?.responseText) {
              try { payload = JSON.parse(response.responseText); } catch {
              }
            }
            const status = Number(response?.status) || 0;
            finish(resolve, {
              ok: status >= 200 && status < 300,
              status,
              statusText: String(response?.statusText || ""),
              json: async () => payload
            });
          },
          onerror: () => fail(new Error("网络请求失败")),
          ontimeout: () => fail(new Error("请求超时")),
          onabort: () => fail(new Error("请求已取消"))
        });
      } catch (error) {
        fail(error);
      }
    });
  }
  async function downloadRequestJson(url, options = {}) {
    const fetchImpl = typeof window !== "undefined" && typeof window.fetch === "function" ? window.fetch.bind(window) : null;
    const requestApi = getDownloadJsonRequestApi();
    const hasGmRequest = !!requestApi;
    const preferExtensionBridge = Boolean(globalThis.__BILIKIT_EDGE_ADAPTER__) && !!globalThis.__BILIKIT_EDGE_GM_XMLHTTPREQUEST__;
    const timeout = Math.max(1, Number(options.timeout) || DOWNLOAD_JSON_TIMEOUT);
    if (preferExtensionBridge) {
      return downloadRequestJsonViaGm(url, { ...options, timeout, bilikitBridge: true });
    }
    if (fetchImpl) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const externalSignal = options.signal;
      let timer = 0;
      let rejectAbort = null;
      const abortFetch = () => {
        try { controller?.abort(); } catch {
        }
      };
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          abortFetch();
          reject(new Error("页面请求超时"));
        }, timeout);
      });
      const abortPromise = externalSignal ? new Promise((_, reject) => {
        rejectAbort = reject;
      }) : null;
      const onExternalAbort = () => {
        abortFetch();
        rejectAbort?.(new Error("请求已取消"));
      };
      if (externalSignal?.aborted) onExternalAbort();
      externalSignal?.addEventListener?.("abort", onExternalAbort, { once: true });
      try {
        const fetchPromise = fetchImpl(url, {
          credentials: "include",
          cache: "no-store",
          ...options,
          signal: controller?.signal || options.signal
        });
        return await Promise.race([fetchPromise, timeoutPromise, ...(abortPromise ? [abortPromise] : [])]);
      } catch (error) {
        if (externalSignal?.aborted || !hasGmRequest) throw error;
        // 页面 fetch 可能被 CORS、页面 Hook 或网络策略拒绝；超时也必须
        // 进入同一条 GM/扩展桥接回退路径，不能让批量任务永久停在 0%。
      } finally {
        clearTimeout(timer);
        rejectAbort = null;
        externalSignal?.removeEventListener?.("abort", onExternalAbort);
      }
    }
    return downloadRequestJsonViaGm(url, { ...options, timeout });
  }
  const DOWNLOAD_WORKER_SOURCE = "/*! Mediabunny 1.59.1 | Copyright (c) 2023-2026 Vanilagy | MPL-2.0 | https://github.com/Vanilagy/mediabunny */\n(()=>{function p(t){if(!t)throw new Error(\"Assertion failed.\")}var Ms=Math.PI/180,Os=180/Math.PI,zs=t=>{let e=(t%360+360)%360;if(e===0||e===90||e===180||e===270)return e;throw new Error(`Invalid rotation ${t}.`)},pt=[1,0,0,0,1,0,0,0,1],Mi=(t,e,r)=>{let[i,s,,o,n]=t,a=Math.abs(i)*e+Math.abs(o)*r,c=Math.abs(s)*e+Math.abs(n)*r;return ht(ht(Fi(-e/2,-r/2),t),Fi(a/2,c/2))},qt=t=>{let[e,r]=t,i=Math.atan2(r,Nr(t)?-e:e);return zs(Us(i*Os,90))},Nr=t=>{let[e,r,,i,s]=t;return e*s-r*i<0},Oi=t=>{let e=t*Ms,r=Math.round(Math.cos(e)),i=Math.round(Math.sin(e));return[r,i,0,-i,r,0,0,0,1]},Fi=(t,e)=>[1,0,0,0,1,0,t,e,1],zi=(t,e)=>[t,0,0,0,e,0,0,0,1],ht=(t,e)=>{let r=new Array(9);for(let i=0;i<3;i++)for(let s=0;s<3;s++)r[3*i+s]=t[3*i]*e[s]+t[3*i+1]*e[3+s]+t[3*i+2]*e[6+s];return r};var Z=t=>t&&t[t.length-1],ke=t=>t>=0&&t<2**32,Di=t=>t>=-(2**31)&&t<2**31,S=t=>{let e=0;for(;t.readBits(1)===0&&e<32;)e++;if(e>=32)throw new Error(\"Invalid exponential-Golomb code.\");return(1<<e)-1+t.readBits(e)};var _e=t=>{let e=S(t);return(e&1)===0?-(e>>1):e+1>>1};var ae=t=>t.constructor===Uint8Array?t:ArrayBuffer.isView(t)?new Uint8Array(t.buffer,t.byteOffset,t.byteLength):new Uint8Array(t),H=t=>t.constructor===DataView?t:ArrayBuffer.isView(t)?new DataView(t.buffer,t.byteOffset,t.byteLength):new DataView(t),Ds=typeof globalThis.TextEncoder<\"u\"?globalThis.TextEncoder:class{constructor(){this.encoding=\"utf-8\"}encode(e=\"\"){let r=new Uint8Array(3*e.length),i=0;for(let s=0;s<e.length;s++){let o=e.charCodeAt(s);if(o<128)r[i++]=o;else if(o<2048)r[i++]=192|o>>6,r[i++]=128|o&63;else if(o<55296||o>57343)r[i++]=224|o>>12,r[i++]=128|o>>6&63,r[i++]=128|o&63;else{let n=s+1<e.length?e.charCodeAt(s+1):0;o<56320&&n>=56320&&n<=57343?(o=65536+(o-55296<<10)+(n-56320),s++,r[i++]=240|o>>18,r[i++]=128|o>>12&63,r[i++]=128|o>>6&63,r[i++]=128|o&63):(r[i++]=239,r[i++]=191,r[i++]=189)}}return r.slice(0,i)}},qr=typeof globalThis.TextDecoder<\"u\"?globalThis.TextDecoder:class{constructor(e=\"utf-8\"){let r=e.trim().toLowerCase();if(r===\"utf-8\"||r===\"utf8\"||r===\"unicode-1-1-utf-8\")this.encoding=\"utf-8\";else if(r===\"utf-16le\"||r===\"utf-16\")this.encoding=\"utf-16le\";else if(r===\"utf-16be\")this.encoding=\"utf-16be\";else throw new RangeError(`The encoding label provided ('${e}') is invalid.`)}decode(e){let r=e?ae(e):new Uint8Array(0),i=[];if(this.encoding===\"utf-8\"){let o=r.length>=3&&r[0]===239&&r[1]===187&&r[2]===191?3:0;for(;o<r.length;){let n=r[o];if(n<128){i.push(n),o++;continue}let a,c;if(n>=194&&n<224)a=1,c=n&31;else if(n>=224&&n<240)a=2,c=n&15;else if(n>=240&&n<245)a=3,c=n&7;else{i.push(65533),o++;continue}let l=n===224?160:n===240?144:128,u=n===237?159:n===244?143:191,d=1;for(;d<=a;d++){let f=o+d<r.length?r[o+d]:0;if(f<l||f>u)break;c=c<<6|f&63,l=128,u=191}o+=d,d<=a?i.push(65533):c>=65536?(c-=65536,i.push(55296|c>>10,56320|c&1023)):i.push(c)}}else{let o=this.encoding===\"utf-16le\",n=o?255:254,a=o?254:255,c=r.length>=2&&r[0]===n&&r[1]===a?2:0;for(;c+1<r.length;){let l=o?r[c]|r[c+1]<<8:r[c]<<8|r[c+1];if(c+=2,l>=55296&&l<=56319){let u=c+1<r.length?o?r[c]|r[c+1]<<8:r[c]<<8|r[c+1]:-1;u>=56320&&u<=57343?(i.push(l,u),c+=2):i.push(65533)}else l>=56320&&l<=57343?i.push(65533):i.push(l)}c<r.length&&i.push(65533)}let s=\"\";for(let o=0;o<i.length;o+=8192)s+=String.fromCharCode(...i.slice(o,o+8192));return s}},Ne=new qr,fe=new Ds;var Hr=t=>Object.fromEntries(Object.entries(t).map(([e,r])=>[r,e])),et={bt709:1,bt470bg:5,smpte170m:6,bt2020:9,smpte432:12},qe=Hr(et),tt={bt709:1,smpte170m:6,linear:8,\"iec61966-2-1\":13,pq:16,hlg:18},He=Hr(tt),rt={rgb:0,bt709:1,bt470bg:5,smpte170m:6,\"bt2020-ncl\":9},Qe=Hr(rt),Qr=t=>!!t&&!!t.primaries&&!!t.transfer&&!!t.matrix&&t.fullRange!==void 0,Ui=t=>!t||t.primaries==null&&t.transfer==null&&t.matrix==null&&t.fullRange==null,Li={primaries:void 0,transfer:void 0,matrix:void 0,fullRange:void 0},jr=t=>t instanceof ArrayBuffer||typeof SharedArrayBuffer<\"u\"&&t instanceof SharedArrayBuffer||ArrayBuffer.isView(t),mt=class{constructor(){this.currentPromise=Promise.resolve(),this.pending=0}async acquire(){let e,r=new Promise(s=>{let o=!1;e=()=>{o||(s(),this.pending--,o=!0)}}),i=this.currentPromise;return this.currentPromise=r,this.pending++,await i,e}},Vi=/^[0-9a-fA-F]+$/,je=t=>[...t].map(e=>e.toString(16).padStart(2,\"0\")).join(\"\"),Wi=t=>{p(t.length%2===0);let e=new Uint8Array(t.length/2);for(let r=0;r<t.length;r+=2)e[r/2]=parseInt(t.slice(r,r+2),16);return e},Kr=t=>(t=t>>1&1431655765|(t&1431655765)<<1,t=t>>2&858993459|(t&858993459)<<2,t=t>>4&252645135|(t&252645135)<<4,t=t>>8&16711935|(t&16711935)<<8,t=t>>16&65535|(t&65535)<<16,t>>>0),$r=(t,e,r)=>{let i=0,s=t.length-1,o=-1;for(;i<=s;){let n=i+s>>1,a=r(t[n]);a===e?(o=n,s=n-1):a<e?i=n+1:s=n-1}return o},Y=(t,e,r)=>{let i=0,s=t.length-1,o=-1;for(;i<=s;){let n=i+(s-i+1)/2|0;r(t[n])<=e?(o=n,i=n+1):s=n-1}return o};var Ke=()=>{let t,e;return{promise:new Promise((i,s)=>{t=i,e=s}),resolve:t,reject:e}},Gr=(t,e)=>{let r=t.indexOf(e);r!==-1&&t.splice(r,1)};var Ni=(t,e)=>{for(let r=t.length-1;r>=0;r--)if(e(t[r]))return r;return-1};var Pe=t=>{throw new Error(`Unexpected value: ${t}`)},Ht=(t,e,r)=>{let i=t.getUint8(e),s=t.getUint8(e+1),o=t.getUint8(e+2);return r?i|s<<8|o<<16:i<<16|s<<8|o};var qi=(t,e,r,i)=>{r=r>>>0,r=r&16777215,i?(t.setUint8(e,r&255),t.setUint8(e+1,r>>>8&255),t.setUint8(e+2,r>>>16&255)):(t.setUint8(e,r>>>16&255),t.setUint8(e+1,r>>>8&255),t.setUint8(e+2,r&255))};var gt=(t,e,r)=>Math.max(e,Math.min(r,t));var Qt=\"und\",Hi=t=>{let e=Math.round(t);return Math.abs(t/e-1)<10*Number.EPSILON?e:t},Us=(t,e)=>Math.round(t/e)*e,Qi=(t,e)=>Math.round(t*e)/e;var nr=t=>{let e=0;for(;t!==0;)t&=t-1,e++;return e},Ls=/^[a-z]{3}$/,sr=t=>Ls.test(t),Xr=1e6*(1+Number.EPSILON);var ji=(t,e)=>{let r=t<0?-1:1;t=Math.abs(t);let i=0,s=1,o=1,n=0,a=t;for(;;){let c=Math.floor(a),l=c*o+i,u=c*n+s;if(u>e)return{num:r*o,den:n};if(i=o,s=n,o=l,n=u,a=1/(a-c),!isFinite(a))break}return{num:r*o,den:n}};var Wr=null,Zr=()=>Wr!==null?Wr:Wr=!!(typeof navigator<\"u\"&&(navigator.vendor?.includes(\"Google Inc\")||/Chrome/.test(navigator.userAgent)));var Vs=(async()=>{})().constructor,F=t=>t instanceof Vs||t instanceof Promise?!0:typeof t?.then==\"function\";var or=function*(t){for(let e in t){let r=t[e];r!==void 0&&(yield{key:e,value:r})}};var Ki=(t,e)=>{if(t.length!==e.length)return!1;for(let r=0;r<t.length;r++)if(t[r]!==e[r])return!1;return!0},ar=()=>{Symbol.dispose??=Symbol(\"Symbol.dispose\")},it=t=>typeof t==\"number\"&&!Number.isNaN(t);var $i=(t,e)=>{let r=0;for(let i=0;i<t.length;i++)e(t[i])&&r++;return r},Gi=(t,e)=>{let r=-1,i=1/0;for(let s=0;s<t.length;s++){let o=e(t[s]);o<i&&(i=o,r=s)}return r};var yt=t=>{p(Number.isInteger(t.num)),p(Number.isInteger(t.den)),p(t.den!==0);let e=Math.abs(t.num),r=Math.abs(t.den);for(;r!==0;){let s=e%r;e=r,r=s}let i=e||1;return{num:t.num/i,den:t.den/i}};var cr=t=>Array.isArray(t)?t:[t],de=class{constructor(){this._listeners=new Map}on(e,r,i){this._listeners.has(e)||this._listeners.set(e,new Set);let s={fn:r,once:i?.once??!1};return this._listeners.get(e).add(s),()=>{this._listeners.get(e)?.delete(s)}}_emit(...e){let[r,i]=e,s=this._listeners.get(r);if(s)for(let o of s){try{o.fn(i)}catch(n){console.error(n)}o.once&&s.delete(o)}}};var Xi=t=>t!==null&&typeof t==\"object\"&&Object.getPrototypeOf(t)===Object.prototype&&Object.values(t).every(e=>typeof e==\"string\");var Ce;(function(t){t[t.Silent=0]=\"Silent\",t[t.Errors=1]=\"Errors\",t[t.Warnings=2]=\"Warnings\",t[t.Info=3]=\"Info\"})(Ce||(Ce={}));var R=class t{constructor(){}static get level(){return t._level}static set level(e){if(e!==Ce.Silent&&e!==Ce.Errors&&e!==Ce.Warnings&&e!==Ce.Info)throw new TypeError(\"Invalid log level. Use one of the values of the LogLevel enum.\");t._level=e}static get _emitter(){return t._emitterInstance??=new de}static on(e,r,i){return t._emitter.on(e,r,i)}static _error(...e){t._emitter._emit(\"error\",e),t._level>=Ce.Errors&&console.error(...e)}static _warn(...e){t._emitter._emit(\"warn\",e),t._level>=Ce.Warnings&&console.warn(...e)}static _info(...e){t._emitter._emit(\"info\",e),t._level>=Ce.Info&&console.info(...e)}};R._level=Ce.Info;R._emitterInstance=null;var ye=class{constructor(e,r){if(this.data=e,this.mimeType=r,!(e instanceof Uint8Array))throw new TypeError(\"data must be a Uint8Array.\");if(typeof r!=\"string\")throw new TypeError(\"mimeType must be a string.\")}},Yr=class{constructor(e,r,i,s){if(this.data=e,this.mimeType=r,this.name=i,this.description=s,!(e instanceof Uint8Array))throw new TypeError(\"data must be a Uint8Array.\");if(r!==void 0&&typeof r!=\"string\")throw new TypeError(\"mimeType, when provided, must be a string.\");if(i!==void 0&&typeof i!=\"string\")throw new TypeError(\"name, when provided, must be a string.\");if(s!==void 0&&typeof s!=\"string\")throw new TypeError(\"description, when provided, must be a string.\")}},Zi=t=>{if(!t||typeof t!=\"object\")throw new TypeError(\"tags must be an object.\");if(t.title!==void 0&&typeof t.title!=\"string\")throw new TypeError(\"tags.title, when provided, must be a string.\");if(t.description!==void 0&&typeof t.description!=\"string\")throw new TypeError(\"tags.description, when provided, must be a string.\");if(t.artist!==void 0&&typeof t.artist!=\"string\")throw new TypeError(\"tags.artist, when provided, must be a string.\");if(t.album!==void 0&&typeof t.album!=\"string\")throw new TypeError(\"tags.album, when provided, must be a string.\");if(t.albumArtist!==void 0&&typeof t.albumArtist!=\"string\")throw new TypeError(\"tags.albumArtist, when provided, must be a string.\");if(t.trackNumber!==void 0&&(!Number.isInteger(t.trackNumber)||t.trackNumber<=0))throw new TypeError(\"tags.trackNumber, when provided, must be a positive integer.\");if(t.tracksTotal!==void 0&&(!Number.isInteger(t.tracksTotal)||t.tracksTotal<=0))throw new TypeError(\"tags.tracksTotal, when provided, must be a positive integer.\");if(t.discNumber!==void 0&&(!Number.isInteger(t.discNumber)||t.discNumber<=0))throw new TypeError(\"tags.discNumber, when provided, must be a positive integer.\");if(t.discsTotal!==void 0&&(!Number.isInteger(t.discsTotal)||t.discsTotal<=0))throw new TypeError(\"tags.discsTotal, when provided, must be a positive integer.\");if(t.genre!==void 0&&typeof t.genre!=\"string\")throw new TypeError(\"tags.genre, when provided, must be a string.\");if(t.date!==void 0&&(!(t.date instanceof Date)||Number.isNaN(t.date.getTime())))throw new TypeError(\"tags.date, when provided, must be a valid Date.\");if(t.beatsPerMinute!==void 0&&(!Number.isInteger(t.beatsPerMinute)||t.beatsPerMinute<=0))throw new TypeError(\"tags.beatsPerMinute, when provided, must be a positive integer.\");if(t.lyrics!==void 0&&typeof t.lyrics!=\"string\")throw new TypeError(\"tags.lyrics, when provided, must be a string.\");if(t.images!==void 0){if(!Array.isArray(t.images))throw new TypeError(\"tags.images, when provided, must be an array.\");for(let e of t.images){if(!e||typeof e!=\"object\")throw new TypeError(\"Each image in tags.images must be an object.\");if(!(e.data instanceof Uint8Array))throw new TypeError(\"Each image.data must be a Uint8Array.\");if(typeof e.mimeType!=\"string\")throw new TypeError(\"Each image.mimeType must be a string.\");if(![\"coverFront\",\"coverBack\",\"unknown\"].includes(e.kind))throw new TypeError(\"Each image.kind must be 'coverFront', 'coverBack', or 'unknown'.\")}}if(t.comment!==void 0&&typeof t.comment!=\"string\")throw new TypeError(\"tags.comment, when provided, must be a string.\");if(t.raw!==void 0){if(!t.raw||typeof t.raw!=\"object\")throw new TypeError(\"tags.raw, when provided, must be an object.\");for(let e of Object.values(t.raw))if(e!==null&&typeof e!=\"string\"&&!(Array.isArray(e)&&e.every(r=>typeof r==\"string\"))&&!(e instanceof Uint8Array)&&!(e instanceof ye)&&!(e instanceof Yr)&&!Xi(e))throw new TypeError(\"Each value in tags.raw must be a string, string array, Uint8Array, RichImageData, AttachedFile, Record<string, string>, or null.\")}};var Yi={default:!0,primary:!0,forced:!1,original:!1,commentary:!1,hearingImpaired:!1,visuallyImpaired:!1},Ji=t=>{if(!t||typeof t!=\"object\")throw new TypeError(\"disposition must be an object.\");if(t.default!==void 0&&typeof t.default!=\"boolean\")throw new TypeError(\"disposition.default must be a boolean.\");if(t.primary!==void 0&&typeof t.primary!=\"boolean\")throw new TypeError(\"disposition.primary must be a boolean.\");if(t.forced!==void 0&&typeof t.forced!=\"boolean\")throw new TypeError(\"disposition.forced must be a boolean.\");if(t.original!==void 0&&typeof t.original!=\"boolean\")throw new TypeError(\"disposition.original must be a boolean.\");if(t.commentary!==void 0&&typeof t.commentary!=\"boolean\")throw new TypeError(\"disposition.commentary must be a boolean.\");if(t.hearingImpaired!==void 0&&typeof t.hearingImpaired!=\"boolean\")throw new TypeError(\"disposition.hearingImpaired must be a boolean.\");if(t.visuallyImpaired!==void 0&&typeof t.visuallyImpaired!=\"boolean\")throw new TypeError(\"disposition.visuallyImpaired must be a boolean.\")};var D=class t{constructor(e){this.bytes=e,this.pos=0}seekToByte(e){this.pos=8*e}readBit(){let e=Math.floor(this.pos/8),r=this.bytes[e]??0,i=7-(this.pos&7),s=(r&1<<i)>>i;return this.pos++,s}readBits(e){if(e===1)return this.readBit();let r=0;for(let i=0;i<e;i++)r<<=1,r|=this.readBit();return r}writeBits(e,r){let i=this.pos+e;for(let s=this.pos;s<i;s++){let o=Math.floor(s/8),n=this.bytes[o],a=7-(s&7);n&=~(1<<a),n|=(r&1<<i-s-1)>>i-s-1<<a,this.bytes[o]=n}this.pos=i}copyBits(e,r){let i=0;for(i;i<e-7;i+=8)this.writeBits(8,r.readBits(8));let s=e-i;s>0&&this.writeBits(s,r.readBits(s))}readAlignedByte(){if(this.pos%8!==0)throw new Error(\"Bitstream is not byte-aligned.\");let e=this.pos/8,r=this.bytes[e]??0;return this.pos+=8,r}skipBits(e){this.pos+=e}getBitsLeft(){return this.bytes.length*8-this.pos}clone(){let e=new t(this.bytes);return e.pos=this.pos,e}};var jt=[96e3,88200,64e3,48e3,44100,32e3,24e3,22050,16e3,12e3,11025,8e3,7350],lr=[-1,1,2,3,4,5,6,8],ur=t=>{if(!t||t.byteLength<2)throw new TypeError(\"AAC description must be at least 2 bytes long.\");let e=new D(t),r=Jr(e),{frequencyIndex:i,sampleRate:s}=ei(e),o=e.readBits(4),n=null;o>=1&&o<=7&&(n=lr[o]);let a=r,c=!1,l=s;if(r===5||r===29)c=r===29,l=ei(e).sampleRate,a=Jr(e),a===22&&e.skipBits(4);else for(;e.getBitsLeft()>15;){let u=e.pos;if(e.readBits(11)!==695){e.pos=u+1;continue}Jr(e)===5&&e.readBits(1)&&(l=ei(e).sampleRate,e.getBitsLeft()>11&&e.readBits(11)===1352&&(c=!!e.readBits(1)));break}return n!==null&&n>1&&(c=!1),{objectType:r,coreObjectType:a,frequencyIndex:i,channelConfiguration:o,outputSampleRate:l,outputNumberOfChannels:c&&n===1?2:n}},Jr=t=>{let e=t.readBits(5);return e===31?32+t.readBits(6):e},ei=t=>{let e=t.readBits(4);return e===15?{frequencyIndex:e,sampleRate:t.readBits(24)}:{frequencyIndex:e,sampleRate:e<jt.length?jt[e]:null}},rn=t=>{let e=t.objectType===5||t.objectType===29,r=t.objectType===29,i=e?t.outputSampleRate/2:t.outputSampleRate,s=r?1:t.outputNumberOfChannels,o=lr.indexOf(s);if(o===-1)throw new TypeError(`Unsupported number of channels: ${t.outputNumberOfChannels}`);let n=16;t.objectType>=32&&(n+=6),ti(i)===15&&(n+=24),e&&(n+=9,ti(t.outputSampleRate)===15&&(n+=24));let a=Math.ceil(n/8),c=new Uint8Array(a),l=new D(c);return en(l,t.objectType),tn(l,i),l.writeBits(4,o),e&&(tn(l,t.outputSampleRate),en(l,2)),l.writeBits(3,0),c},en=(t,e)=>{e<32?t.writeBits(5,e):(t.writeBits(5,31),t.writeBits(6,e-32))},tn=(t,e)=>{let r=ti(e);t.writeBits(4,r),r===15&&t.writeBits(24,e)},ti=t=>{let e=jt.indexOf(t);return e===-1?15:e};var Kt=[48e3,44100,32e3],ri=[24e3,22050,16e3];var Re;(function(t){t[t.NON_IDR_SLICE=1]=\"NON_IDR_SLICE\",t[t.SLICE_DPA=2]=\"SLICE_DPA\",t[t.SLICE_DPB=3]=\"SLICE_DPB\",t[t.SLICE_DPC=4]=\"SLICE_DPC\",t[t.IDR=5]=\"IDR\",t[t.SEI=6]=\"SEI\",t[t.SPS=7]=\"SPS\",t[t.PPS=8]=\"PPS\",t[t.AUD=9]=\"AUD\",t[t.SPS_EXT=13]=\"SPS_EXT\"})(Re||(Re={}));var re;(function(t){t[t.RASL_N=8]=\"RASL_N\",t[t.RASL_R=9]=\"RASL_R\",t[t.BLA_W_LP=16]=\"BLA_W_LP\",t[t.RSV_IRAP_VCL23=23]=\"RSV_IRAP_VCL23\",t[t.VPS_NUT=32]=\"VPS_NUT\",t[t.SPS_NUT=33]=\"SPS_NUT\",t[t.PPS_NUT=34]=\"PPS_NUT\",t[t.AUD_NUT=35]=\"AUD_NUT\",t[t.PREFIX_SEI_NUT=39]=\"PREFIX_SEI_NUT\",t[t.SUFFIX_SEI_NUT=40]=\"SUFFIX_SEI_NUT\"})(re||(re={}));var wt=function*(t){let e=0,r=-1;for(;e<t.length-2;){let i=t.indexOf(0,e);if(i===-1||i>=t.length-2)break;e=i;let s=0;if(e+3<t.length&&t[e+1]===0&&t[e+2]===0&&t[e+3]===1?s=4:t[e+1]===0&&t[e+2]===1&&(s=3),s===0){e++;continue}r!==-1&&e>r&&(yield{offset:r,length:e-r}),r=e+s,e=r}r!==-1&&r<t.length&&(yield{offset:r,length:t.length-r})},cn=function*(t,e){let r=0,i=new DataView(t.buffer,t.byteOffset,t.byteLength);for(;r+e<=t.length;){let s;e===1?s=i.getUint8(r):e===2?s=i.getUint16(r,!1):e===3?s=Ht(i,r,!1):(p(e===4),s=i.getUint32(r,!1)),r+=e,yield{offset:r,length:s},r+=s}},Ns=(t,e)=>{if(e.description){let s=(ae(e.description)[4]&3)+1;return cn(t,s)}else return wt(t)},ln=t=>t&31,hr=t=>{let e=[],r=t.length;for(let i=0;i<r;i++)i+2<r&&t[i]===0&&t[i+1]===0&&t[i+2]===3?(e.push(0,0),i+=2):e.push(t[i]);return new Uint8Array(e)};var ic=new Uint8Array([0,0,0,1]);var un=(t,e)=>{let r=t.reduce((o,n)=>o+e+n.byteLength,0),i=new Uint8Array(r),s=0;for(let o of t){let n=new DataView(i.buffer,i.byteOffset,i.byteLength);switch(e){case 1:n.setUint8(s,o.byteLength);break;case 2:n.setUint16(s,o.byteLength,!1);break;case 3:qi(n,s,o.byteLength,!1);break;case 4:n.setUint32(s,o.byteLength,!1);break}s+=e,i.set(o,s),s+=o.byteLength}return i};var mr=t=>{try{let e=[],r=[],i=[];for(let a of wt(t)){let c=t.subarray(a.offset,a.offset+a.length),l=ln(c[0]);l===Re.SPS?e.push(c):l===Re.PPS?r.push(c):l===Re.SPS_EXT&&i.push(c)}if(e.length===0||r.length===0)return null;let s=e[0],o=si(s);p(o!==null);let n=o.profileIdc===100||o.profileIdc===110||o.profileIdc===122||o.profileIdc===144;return{configurationVersion:1,avcProfileIndication:o.profileIdc,profileCompatibility:o.constraintFlags,avcLevelIndication:o.levelIdc,lengthSizeMinusOne:3,sequenceParameterSets:e,pictureParameterSets:r,chromaFormat:n?o.chromaFormatIdc:null,bitDepthLumaMinus8:n?o.bitDepthLumaMinus8:null,bitDepthChromaMinus8:n?o.bitDepthChromaMinus8:null,sequenceParameterSetExt:n?i:null}}catch(e){return R._error(\"Error building AVC Decoder Configuration Record:\",e),null}},dn=t=>{let e=[];e.push(t.configurationVersion),e.push(t.avcProfileIndication),e.push(t.profileCompatibility),e.push(t.avcLevelIndication),e.push(252|t.lengthSizeMinusOne&3),e.push(224|t.sequenceParameterSets.length&31);for(let r of t.sequenceParameterSets){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let s=0;s<i;s++)e.push(r[s])}e.push(t.pictureParameterSets.length);for(let r of t.pictureParameterSets){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let s=0;s<i;s++)e.push(r[s])}if((t.avcProfileIndication===100||t.avcProfileIndication===110||t.avcProfileIndication===122||t.avcProfileIndication===144)&&t.chromaFormat!==null){p(t.bitDepthLumaMinus8!==null),p(t.bitDepthChromaMinus8!==null),p(t.sequenceParameterSetExt!==null),e.push(252|t.chromaFormat&3),e.push(248|t.bitDepthLumaMinus8&7),e.push(248|t.bitDepthChromaMinus8&7),e.push(t.sequenceParameterSetExt.length);for(let r of t.sequenceParameterSetExt){let i=r.byteLength;e.push(i>>8),e.push(i&255);for(let s=0;s<i;s++)e.push(r[s])}}return new Uint8Array(e)},fn=t=>{try{let e=H(t),r=0,i=e.getUint8(r++),s=e.getUint8(r++),o=e.getUint8(r++),n=e.getUint8(r++),a=e.getUint8(r++)&3,c=e.getUint8(r++)&31,l=[];for(let h=0;h<c;h++){let m=e.getUint16(r,!1);r+=2,l.push(t.subarray(r,r+m)),r+=m}let u=e.getUint8(r++),d=[];for(let h=0;h<u;h++){let m=e.getUint16(r,!1);r+=2,d.push(t.subarray(r,r+m)),r+=m}let f={configurationVersion:i,avcProfileIndication:s,profileCompatibility:o,avcLevelIndication:n,lengthSizeMinusOne:a,sequenceParameterSets:l,pictureParameterSets:d,chromaFormat:null,bitDepthLumaMinus8:null,bitDepthChromaMinus8:null,sequenceParameterSetExt:null};if((s===100||s===110||s===122||s===144)&&r+4<=t.length){let h=e.getUint8(r++)&3,m=e.getUint8(r++)&7,g=e.getUint8(r++)&7,y=e.getUint8(r++);f.chromaFormat=h,f.bitDepthLumaMinus8=m,f.bitDepthChromaMinus8=g;let w=[];for(let A=0;A<y;A++){let x=e.getUint16(r,!1);r+=2,w.push(t.subarray(r,r+x)),r+=x}f.sequenceParameterSetExt=w}return f}catch(e){return R._error(\"Error deserializing AVC Decoder Configuration Record:\",e),null}},hn={1:{num:1,den:1},2:{num:12,den:11},3:{num:10,den:11},4:{num:16,den:11},5:{num:40,den:33},6:{num:24,den:11},7:{num:20,den:11},8:{num:32,den:11},9:{num:80,den:33},10:{num:18,den:11},11:{num:15,den:11},12:{num:64,den:33},13:{num:160,den:99},14:{num:4,den:3},15:{num:3,den:2},16:{num:2,den:1}},si=t=>{try{let e=hr(t),r=new D(e);if(r.skipBits(1),r.skipBits(2),r.readBits(5)!==7)return null;let s=r.readAlignedByte(),o=r.readAlignedByte(),n=r.readAlignedByte();S(r);let a=1,c=0,l=0,u=0;if((s===100||s===110||s===122||s===244||s===44||s===83||s===86||s===118||s===128)&&(a=S(r),a===3&&(u=r.readBits(1)),c=S(r),l=S(r),r.skipBits(1),r.readBits(1))){for(let $=0;$<(a!==3?8:12);$++)if(r.readBits(1)){let Be=$<6?16:64,Se=8,ne=8;for(let We=0;We<Be;We++){if(ne!==0){let Je=_e(r);ne=(Se+Je+256)%256}Se=ne===0?Se:ne}}}S(r);let d=S(r);if(d===0)S(r);else if(d===1){r.skipBits(1),_e(r),_e(r);let K=S(r);for(let $=0;$<K;$++)_e(r)}S(r),r.skipBits(1);let f=S(r),h=S(r),m=16*(f+1),g=16*(h+1),y=m,w=g,A=r.readBits(1);if(A||r.skipBits(1),r.skipBits(1),r.readBits(1)){let K=S(r),$=S(r),ue=S(r),Be=S(r),Se,ne;if((u===0?a:0)===0)Se=1,ne=2-A;else{let Je=a===3?1:2,ir=a===1?2:1;Se=Je,ne=ir*(2-A)}y-=Se*(K+$),w-=ne*(ue+Be)}let v=2,U=2,M=2,_=0,E={num:1,den:1},N=null,I=null,j=null,z=null,le=r.pos;if(r.readBits(1)){if(r.readBits(1)){let Je=r.readBits(8);if(Je===255)E={num:r.readBits(16),den:r.readBits(16)};else{let ir=hn[Je];ir&&(E=ir)}}r.readBits(1)&&r.skipBits(1),r.readBits(1)&&(r.skipBits(3),_=r.readBits(1),r.readBits(1)&&(v=r.readBits(8),U=r.readBits(8),M=r.readBits(8))),r.readBits(1)&&(S(r),S(r)),r.readBits(1)&&(r.skipBits(32),r.skipBits(32),r.skipBits(1));let ne=r.readBits(1);ne&&nn(r);let We=r.readBits(1);We&&nn(r),(ne||We)&&r.skipBits(1),r.skipBits(1),j=r.pos,z=r.readBits(1),z&&(r.skipBits(1),S(r),S(r),S(r),S(r),N=S(r),I=S(r))}if(N===null){p(I===null);let K=o&16;if((s===44||s===86||s===100||s===110||s===122||s===244)&&K)N=0,I=0;else{let $=f+1,ue=h+1,Be=(2-A)*ue,Se=ni.find(We=>We.level>=n)??Z(ni),ne=Math.min(Math.floor(Se.maxDpbMbs/($*Be)),16);N=ne,I=ne}}return p(I!==null),{emulationUnpreventedBytes:e,profileIdc:s,constraintFlags:o,levelIdc:n,frameMbsOnlyFlag:A,chromaFormatIdc:a,bitDepthLumaMinus8:c,bitDepthChromaMinus8:l,codedWidth:m,codedHeight:g,displayWidth:y,displayHeight:w,pixelAspectRatio:E,colourPrimaries:v,matrixCoefficients:M,transferCharacteristics:U,fullRangeFlag:_,numReorderFrames:N,maxDecFrameBuffering:I,vuiParametersFlagBitOffset:le,bitstreamRestrictionFlagBitOffset:j,bitstreamRestrictionFlag:z}}catch(e){return R._error(\"Error parsing AVC SPS:\",e),null}},nn=t=>{let e=S(t);t.skipBits(4),t.skipBits(4);for(let r=0;r<=e;r++)S(t),S(t),t.skipBits(1);t.skipBits(5),t.skipBits(5),t.skipBits(5),t.skipBits(5)};var qs=(t,e)=>{if(e.description){let s=(ae(e.description)[21]&3)+1;return cn(t,s)}else return wt(t)},ii=t=>t>>1&63,oi=t=>{try{let e=new D(hr(t));e.skipBits(16),e.readBits(4);let r=e.readBits(3),i=e.readBits(1),{general_profile_space:s,general_tier_flag:o,general_profile_idc:n,general_profile_compatibility_flags:a,general_constraint_indicator_flags:c,general_level_idc:l}=Hs(e,r);S(e);let u=S(e),d=0;u===3&&(d=e.readBits(1));let f=S(e),h=S(e),m=f,g=h;if(e.readBits(1)){let z=S(e),le=S(e),ge=S(e),K=S(e),$=1,ue=1,Be=d===0?u:0;Be===1?($=2,ue=2):Be===2&&($=2,ue=1),m-=(z+le)*$,g-=(ge+K)*ue}let y=S(e),w=S(e);S(e);let x=e.readBits(1)?0:r,v=0;for(let z=x;z<=r;z++)S(e),v=S(e),S(e);S(e),S(e),S(e),S(e),S(e),S(e),e.readBits(1)&&e.readBits(1)&&Qs(e),e.skipBits(1),e.skipBits(1),e.readBits(1)&&(e.skipBits(4),e.skipBits(4),S(e),S(e),e.skipBits(1));let U=S(e);if(js(e,U),e.readBits(1)){let z=S(e);for(let le=0;le<z;le++)S(e),e.skipBits(1)}e.skipBits(1),e.skipBits(1);let M=2,_=2,E=2,N=0,I=0,j={num:1,den:1};if(e.readBits(1)){let z=$s(e,r);j=z.pixelAspectRatio,M=z.colourPrimaries,_=z.transferCharacteristics,E=z.matrixCoefficients,N=z.fullRangeFlag,I=z.minSpatialSegmentationIdc}return{displayWidth:m,displayHeight:g,pixelAspectRatio:j,colourPrimaries:M,transferCharacteristics:_,matrixCoefficients:E,fullRangeFlag:N,maxDecFrameBuffering:v+1,spsMaxSubLayersMinus1:r,spsTemporalIdNestingFlag:i,generalProfileSpace:s,generalTierFlag:o,generalProfileIdc:n,generalProfileCompatibilityFlags:a,generalConstraintIndicatorFlags:c,generalLevelIdc:l,chromaFormatIdc:u,bitDepthLumaMinus8:y,bitDepthChromaMinus8:w,minSpatialSegmentationIdc:I}}catch(e){return R._error(\"Error parsing HEVC SPS:\",e),null}},pr=t=>{try{let e=[],r=[],i=[],s=[];for(let l of wt(t)){let u=t.subarray(l.offset,l.offset+l.length),d=ii(u[0]);d===re.VPS_NUT?e.push(u):d===re.SPS_NUT?r.push(u):d===re.PPS_NUT?i.push(u):(d===re.PREFIX_SEI_NUT||d===re.SUFFIX_SEI_NUT)&&s.push(u)}if(r.length===0||i.length===0)return null;let o=oi(r[0]);if(!o)return null;let n=0;if(i.length>0){let l=i[0],u=new D(hr(l));u.skipBits(16),S(u),S(u),u.skipBits(1),u.skipBits(1),u.skipBits(3),u.skipBits(1),u.skipBits(1),S(u),S(u),_e(u),u.skipBits(1),u.skipBits(1),u.readBits(1)&&S(u),_e(u),_e(u),u.skipBits(1),u.skipBits(1),u.skipBits(1),u.skipBits(1);let d=u.readBits(1),f=u.readBits(1);!d&&!f?n=0:d&&!f?n=2:!d&&f?n=3:n=0}let a=[...e.length?[{arrayCompleteness:1,nalUnitType:re.VPS_NUT,nalUnits:e}]:[],...r.length?[{arrayCompleteness:1,nalUnitType:re.SPS_NUT,nalUnits:r}]:[],...i.length?[{arrayCompleteness:1,nalUnitType:re.PPS_NUT,nalUnits:i}]:[],...s.length?[{arrayCompleteness:1,nalUnitType:ii(s[0][0]),nalUnits:s}]:[]];return{configurationVersion:1,generalProfileSpace:o.generalProfileSpace,generalTierFlag:o.generalTierFlag,generalProfileIdc:o.generalProfileIdc,generalProfileCompatibilityFlags:o.generalProfileCompatibilityFlags,generalConstraintIndicatorFlags:o.generalConstraintIndicatorFlags,generalLevelIdc:o.generalLevelIdc,minSpatialSegmentationIdc:o.minSpatialSegmentationIdc,parallelismType:n,chromaFormatIdc:o.chromaFormatIdc,bitDepthLumaMinus8:o.bitDepthLumaMinus8,bitDepthChromaMinus8:o.bitDepthChromaMinus8,avgFrameRate:0,constantFrameRate:0,numTemporalLayers:o.spsMaxSubLayersMinus1+1,temporalIdNested:o.spsTemporalIdNestingFlag,lengthSizeMinusOne:3,arrays:a}}catch(e){return R._error(\"Error building HEVC Decoder Configuration Record:\",e),null}},Hs=(t,e)=>{let r=t.readBits(2),i=t.readBits(1),s=t.readBits(5),o=0;for(let u=0;u<32;u++)o=o<<1|t.readBits(1);let n=new Uint8Array(6);for(let u=0;u<6;u++)n[u]=t.readBits(8);let a=t.readBits(8),c=[],l=[];for(let u=0;u<e;u++)c.push(t.readBits(1)),l.push(t.readBits(1));if(e>0)for(let u=e;u<8;u++)t.skipBits(2);for(let u=0;u<e;u++)c[u]&&t.skipBits(88),l[u]&&t.skipBits(8);return{general_profile_space:r,general_tier_flag:i,general_profile_idc:s,general_profile_compatibility_flags:o,general_constraint_indicator_flags:n,general_level_idc:a}},Qs=t=>{for(let e=0;e<4;e++)for(let r=0;r<(e===3?2:6);r++)if(!t.readBits(1))S(t);else{let s=Math.min(64,1<<4+(e<<1));e>1&&_e(t);for(let o=0;o<s;o++)_e(t)}},js=(t,e)=>{let r=[];for(let i=0;i<e;i++)r[i]=Ks(t,i,e,r)},Ks=(t,e,r,i)=>{let s=0,o=0,n=0;if(e!==0&&(o=t.readBits(1)),o){if(e===r){let c=S(t);n=e-(c+1)}else n=e-1;t.readBits(1),S(t);let a=i[n]??0;for(let c=0;c<=a;c++)t.readBits(1)||t.readBits(1);s=i[n]}else{let a=S(t),c=S(t);for(let l=0;l<a;l++)S(t),t.readBits(1);for(let l=0;l<c;l++)S(t),t.readBits(1);s=a+c}return s},$s=(t,e)=>{let r=2,i=2,s=2,o=0,n=0,a={num:1,den:1};if(t.readBits(1)){let c=t.readBits(8);if(c===255)a={num:t.readBits(16),den:t.readBits(16)};else{let l=hn[c];l&&(a=l)}}return t.readBits(1)&&t.readBits(1),t.readBits(1)&&(t.readBits(3),o=t.readBits(1),t.readBits(1)&&(r=t.readBits(8),i=t.readBits(8),s=t.readBits(8))),t.readBits(1)&&(S(t),S(t)),t.readBits(1),t.readBits(1),t.readBits(1),t.readBits(1)&&(S(t),S(t),S(t),S(t)),t.readBits(1)&&(t.readBits(32),t.readBits(32),t.readBits(1)&&S(t),t.readBits(1)&&Gs(t,!0,e)),t.readBits(1)&&(t.readBits(1),t.readBits(1),t.readBits(1),n=S(t),S(t),S(t),S(t),S(t)),{pixelAspectRatio:a,colourPrimaries:r,transferCharacteristics:i,matrixCoefficients:s,fullRangeFlag:o,minSpatialSegmentationIdc:n}},Gs=(t,e,r)=>{let i=!1,s=!1,o=!1;e&&(i=t.readBits(1)===1,s=t.readBits(1)===1,(i||s)&&(o=t.readBits(1)===1,o&&(t.readBits(8),t.readBits(5),t.readBits(1),t.readBits(5)),t.readBits(4),t.readBits(4),o&&t.readBits(4),t.readBits(5),t.readBits(5),t.readBits(5)));for(let n=0;n<=r;n++){let a=t.readBits(1)===1,c=!0;a||(c=t.readBits(1)===1);let l=!1;c?S(t):l=t.readBits(1)===1;let u=1;l||(u=S(t)+1),i&&sn(t,u,o),s&&sn(t,u,o)}},sn=(t,e,r)=>{for(let i=0;i<e;i++)S(t),S(t),r&&(S(t),S(t)),t.readBits(1)},mn=t=>{let e=[];e.push(t.configurationVersion),e.push((t.generalProfileSpace&3)<<6|(t.generalTierFlag&1)<<5|t.generalProfileIdc&31),e.push(t.generalProfileCompatibilityFlags>>>24&255),e.push(t.generalProfileCompatibilityFlags>>>16&255),e.push(t.generalProfileCompatibilityFlags>>>8&255),e.push(t.generalProfileCompatibilityFlags&255),e.push(...t.generalConstraintIndicatorFlags),e.push(t.generalLevelIdc&255),e.push(240|t.minSpatialSegmentationIdc>>8&15),e.push(t.minSpatialSegmentationIdc&255),e.push(252|t.parallelismType&3),e.push(252|t.chromaFormatIdc&3),e.push(248|t.bitDepthLumaMinus8&7),e.push(248|t.bitDepthChromaMinus8&7),e.push(t.avgFrameRate>>8&255),e.push(t.avgFrameRate&255),e.push((t.constantFrameRate&3)<<6|(t.numTemporalLayers&7)<<3|(t.temporalIdNested&1)<<2|t.lengthSizeMinusOne&3),e.push(t.arrays.length&255);for(let r of t.arrays){e.push((r.arrayCompleteness&1)<<7|0|r.nalUnitType&63),e.push(r.nalUnits.length>>8&255),e.push(r.nalUnits.length&255);for(let i of r.nalUnits){e.push(i.length>>8&255),e.push(i.length&255);for(let s=0;s<i.length;s++)e.push(i[s])}}return new Uint8Array(e)},pn=t=>{try{let e=H(t),r=0,i=e.getUint8(r++),s=e.getUint8(r++),o=s>>6&3,n=s>>5&1,a=s&31,c=e.getUint32(r,!1);r+=4;let l=t.subarray(r,r+6);r+=6;let u=e.getUint8(r++),d=(e.getUint8(r++)&15)<<8|e.getUint8(r++),f=e.getUint8(r++)&3,h=e.getUint8(r++)&3,m=e.getUint8(r++)&7,g=e.getUint8(r++)&7,y=e.getUint16(r,!1);r+=2;let w=e.getUint8(r++),A=w>>6&3,x=w>>3&7,v=w>>2&1,U=w&3,M=e.getUint8(r++),_=[];for(let E=0;E<M;E++){let N=e.getUint8(r++),I=N>>7&1,j=N&63,z=e.getUint16(r,!1);r+=2;let le=[];for(let ge=0;ge<z;ge++){let K=e.getUint16(r,!1);r+=2,le.push(t.subarray(r,r+K)),r+=K}_.push({arrayCompleteness:I,nalUnitType:j,nalUnits:le})}return{configurationVersion:i,generalProfileSpace:o,generalTierFlag:n,generalProfileIdc:a,generalProfileCompatibilityFlags:c,generalConstraintIndicatorFlags:l,generalLevelIdc:u,minSpatialSegmentationIdc:d,parallelismType:f,chromaFormatIdc:h,bitDepthLumaMinus8:m,bitDepthChromaMinus8:g,avgFrameRate:y,constantFrameRate:A,numTemporalLayers:x,temporalIdNested:v,lengthSizeMinusOne:U,arrays:_}}catch(e){return R._error(\"Error deserializing HEVC Decoder Configuration Record:\",e),null}},on;(function(t){t[t.audAllowed=0]=\"audAllowed\",t[t.beforeFirstVcl=1]=\"beforeFirstVcl\",t[t.afterFirstVcl=2]=\"afterFirstVcl\",t[t.eoBitstreamAllowed=3]=\"eoBitstreamAllowed\",t[t.noMoreDataAllowed=4]=\"noMoreDataAllowed\"})(on||(on={}));var Xs={1:{colourPrimaries:5,transferCharacteristics:6,matrixCoefficients:5},2:{colourPrimaries:1,transferCharacteristics:1,matrixCoefficients:1},3:{colourPrimaries:6,transferCharacteristics:6,matrixCoefficients:6},4:{colourPrimaries:7,transferCharacteristics:7,matrixCoefficients:7},5:{colourPrimaries:9,transferCharacteristics:14,matrixCoefficients:9},7:{colourPrimaries:1,transferCharacteristics:13,matrixCoefficients:0}},gn=t=>{let e=new D(t);if(e.readBits(2)!==2)return null;let i=e.readBits(1),o=(e.readBits(1)<<1)+i;if(o===3&&e.skipBits(1),e.readBits(1)===1||e.readBits(1)!==0||(e.skipBits(2),e.readBits(24)!==4817730))return null;let l=8;o>=2&&(l=e.readBits(1)?12:10);let u=e.readBits(3),d=0,f=0;if(u!==7)if(f=e.readBits(1),o===1||o===3){let E=e.readBits(1),N=e.readBits(1);d=!E&&!N?3:E&&!N?2:1,e.skipBits(1)}else d=1;else d=3,f=1;let h=e.readBits(16),m=e.readBits(16),g=h+1,y=m+1,w=g*y,A=Z(nt).level;for(let _ of nt)if(w<=_.maxPictureSize){A=_.level;break}let x=Xs[u],v=x?.colourPrimaries??2,U=x?.transferCharacteristics??2,M=x?.matrixCoefficients??2;return{profile:o,level:A,bitDepth:l,chromaSubsampling:d,videoFullRangeFlag:f,colourPrimaries:v,transferCharacteristics:U,matrixCoefficients:M}},yn=t=>t.colourPrimaries!==2||t.transferCharacteristics!==2||t.matrixCoefficients!==2,wn=function*(t){let e=new D(t),r=()=>{let i=0;for(let s=0;s<8;s++){let o=e.readAlignedByte();if(i+=(o&127)*2**(s*7),!(o&128))break;if(s===7&&o&128)return null}return i>2**32-1?null:i};for(;e.getBitsLeft()>=8;){e.skipBits(1);let i=e.readBits(4),s=e.readBits(1),o=e.readBits(1);e.skipBits(1),s&&e.skipBits(8);let n;if(o){let a=r();if(a===null)return;n=a}else n=Math.floor(e.getBitsLeft()/8);p(e.pos%8===0),yield{type:i,data:t.subarray(e.pos/8,e.pos/8+n)},e.skipBits(n*8)}},ai=t=>{for(let{type:e,data:r}of wn(t)){if(e!==1)continue;let i=new D(r),s=i.readBits(3),o=i.readBits(1),n=i.readBits(1),a=0,c=0,l=0;if(n)a=i.readBits(5);else{let I=i.readBits(1),j=0;if(I){if(i.skipBits(32),i.skipBits(32),i.readBits(1)){let K=0;for(;K<32&&!i.readBits(1);)K++;K<32&&i.skipBits(K)}j=i.readBits(1),j&&(l=i.readBits(5),i.skipBits(32),i.skipBits(5),i.skipBits(5))}let z=i.readBits(1),le=i.readBits(5);for(let ge=0;ge<=le;ge++){i.skipBits(12);let K=i.readBits(5);if(ge===0&&(a=K),K>7){let $=i.readBits(1);ge===0&&(c=$)}if(j&&i.readBits(1)){let ue=l+1;i.skipBits(ue),i.skipBits(ue),i.skipBits(1)}z&&i.readBits(1)&&i.skipBits(4)}}let u=i.readBits(4),d=i.readBits(4),f=u+1;i.skipBits(f);let h=d+1;i.skipBits(h);let m=0;if(n?m=0:m=i.readBits(1),m&&(i.skipBits(4),i.skipBits(3)),i.skipBits(1),i.skipBits(1),i.skipBits(1),!n){i.skipBits(1),i.skipBits(1),i.skipBits(1),i.skipBits(1);let I=i.readBits(1);I&&(i.skipBits(1),i.skipBits(1));let j=i.readBits(1),z=0;j?z=2:z=i.readBits(1),z>0&&(i.readBits(1)||i.skipBits(1)),I&&i.skipBits(3)}i.skipBits(1),i.skipBits(1),i.skipBits(1);let g=i.readBits(1),y=8;s===2&&g?y=i.readBits(1)?12:10:s<=2&&(y=g?10:8);let w=0;s!==1&&(w=i.readBits(1));let A=2,x=2,v=2;i.readBits(1)&&(A=i.readBits(8),x=i.readBits(8),v=i.readBits(8));let M=0,_=1,E=1,N=0;return w?M=i.readBits(1):A===1&&x===13&&v===0?(M=1,_=0,E=0):(M=i.readBits(1),s===0?(_=1,E=1):s===1?(_=0,E=0):y===12?(_=i.readBits(1),E=_?i.readBits(1):0):(_=1,E=0),_&&E&&(N=i.readBits(2))),{profile:s,level:a,tier:c,bitDepth:y,monochrome:w,chromaSubsamplingX:_,chromaSubsamplingY:E,chromaSamplePosition:N,videoFullRangeFlag:M,colourPrimaries:A,transferCharacteristics:x,matrixCoefficients:v}}return null},An=t=>t.colourPrimaries!==2||t.transferCharacteristics!==2||t.matrixCoefficients!==2,bn=t=>{if(t.length<36)return null;let r=H(t);return r.getUint32(4)!==1768124518||r.getUint16(8)<28?null:{fullRange:!1,colourPrimaries:r.getUint8(22),transferCharacteristics:r.getUint8(23),matrixCoefficients:r.getUint8(24)}},xn=t=>{let e=H(t),r=e.getUint8(9),i=e.getUint16(10,!0),s=e.getUint32(12,!0),o=e.getInt16(16,!0),n=e.getUint8(18),a=null;return n&&(a=t.subarray(19,21+r)),{outputChannelCount:r,preSkip:i,inputSampleRate:s,outputGain:o,channelMappingFamily:n,channelMappingTable:a}};var Tn=(t,e,r)=>{switch(t){case\"avc\":{for(let i of Ns(r,e)){let s=r[i.offset],o=ln(s);if(o>=Re.NON_IDR_SLICE&&o<=Re.SLICE_DPC)return\"delta\";if(o===Re.IDR)return\"key\";if(o===Re.SEI&&!Zr()){let n=r.subarray(i.offset,i.offset+i.length),a=hr(n),c=1;do{let l=0;for(;;){let f=a[c++];if(f===void 0||(l+=f,f<255))break}let u=0;for(;;){let f=a[c++];if(f===void 0||(u+=f,f<255))break}if(l===6){let f=new D(a);f.pos=8*c;let h=S(f),m=f.readBits(1);if(h===0&&m===1)return\"key\"}c+=u}while(c<a.length-1)}}return\"delta\"}case\"hevc\":{for(let i of qs(r,e)){let s=ii(r[i.offset]);if(s<re.BLA_W_LP)return\"delta\";if(s<=re.RSV_IRAP_VCL23)return\"key\"}return\"delta\"}case\"vp8\":return(r[0]&1)===0?\"key\":\"delta\";case\"vp9\":{let i=new D(r);if(i.readBits(2)!==2)return null;let s=i.readBits(1);return(i.readBits(1)<<1)+s===3&&i.skipBits(1),i.readBits(1)?null:i.readBits(1)===0?\"key\":\"delta\"}case\"av1\":{let i=!1;for(let{type:s,data:o}of wn(r))if(s===1){let n=new D(o);n.skipBits(4),i=!!n.readBits(1)}else if(s===3||s===6||s===7){if(i)return\"key\";let n=new D(o);return n.readBits(1)?null:n.readBits(2)===0?\"key\":\"delta\"}return null}case\"prores\":return\"key\";default:Pe(t),p(!1)}},dr;(function(t){t[t.STREAMINFO=0]=\"STREAMINFO\",t[t.VORBIS_COMMENT=4]=\"VORBIS_COMMENT\",t[t.PICTURE=6]=\"PICTURE\"})(dr||(dr={}));var ci=[2,1,2,3,3,4,4,5],Sn=t=>{if(t.length<7||t[0]!==11||t[1]!==119)return null;let e=new D(t);e.skipBits(16),e.skipBits(16);let r=e.readBits(2);if(r===3)return null;let i=e.readBits(6),s=e.readBits(5);if(s>8)return null;let o=e.readBits(3),n=e.readBits(3);(n&1)!==0&&n!==1&&e.skipBits(2),(n&4)!==0&&e.skipBits(2),n===2&&e.skipBits(2);let a=e.readBits(1),c=Math.floor(i/2);return{fscod:r,bsid:s,bsmod:o,acmod:n,lfeon:a,bitRateCode:c}},nc=[128,138,192,128,140,192,160,174,240,160,176,240,192,208,288,192,210,288,224,242,336,224,244,336,256,278,384,256,280,384,320,348,480,320,350,480,384,416,288*2,384,418,288*2,448,486,336*2,448,488,336*2,256*2,278*2,384*2,256*2,279*2,384*2,320*2,348*2,480*2,320*2,349*2,480*2,384*2,417*2,576*2,384*2,418*2,576*2,448*2,487*2,672*2,448*2,488*2,672*2,512*2,557*2,768*2,512*2,558*2,768*2,640*2,696*2,960*2,640*2,697*2,960*2,768*2,835*2,1152*2,768*2,836*2,1152*2,896*2,975*2,1344*2,896*2,976*2,1344*2,1024*2,1114*2,1536*2,1024*2,1115*2,1536*2,1152*2,1253*2,1728*2,1152*2,1254*2,1728*2,1280*2,1393*2,1920*2,1280*2,1394*2,1920*2];var sc=new Uint8Array([5,4,65,67,45,51]),oc=new Uint8Array([5,4,69,65,67,51]),Zs=[1,2,3,6],kn=t=>{if(t.length<6||t[0]!==11||t[1]!==119)return null;let e=new D(t);e.skipBits(16);let r=e.readBits(2);if(e.skipBits(3),r!==0&&r!==2)return null;let i=e.readBits(11),s=e.readBits(2),o=0,n;s===3?(o=e.readBits(2),n=3):n=e.readBits(2);let a=e.readBits(3),c=e.readBits(1),l=e.readBits(5);if(l<11||l>16)return null;let u=Zs[n],d;return s<3?d=Kt[s]/1e3:d=ri[o]/1e3,{dataRate:Math.round((i+1)*d/(u*16)),substreams:[{fscod:s,fscod2:o,bsid:l,bsmod:0,acmod:a,lfeon:c,numDepSub:0,chanLoc:0}]}},_n=t=>{if(t.length<2)return null;let e=new D(t),r=e.readBits(13),i=e.readBits(3),s=[];for(let o=0;o<=i&&!(Math.ceil(e.pos/8)+3>t.length);o++){let n=e.readBits(2),a=e.readBits(5);e.skipBits(1),e.skipBits(1);let c=e.readBits(3),l=e.readBits(3),u=e.readBits(1);e.skipBits(3);let d=e.readBits(4),f=0;d>0?f=e.readBits(9):e.skipBits(1),s.push({fscod:n,fscod2:null,bsid:a,bsmod:c,acmod:l,lfeon:u,numDepSub:d,chanLoc:f})}return s.length===0?null:{dataRate:r,substreams:s}},Cn=t=>{let e=t.substreams[0];return p(e),e.fscod<3?Kt[e.fscod]:e.fscod2!==null&&e.fscod2<3?ri[e.fscod2]:null},En=t=>{let e=t.substreams[0];p(e);let r=ci[e.acmod]+e.lfeon;if(e.numDepSub>0){let i=[2,2,1,1,2,2,2,1,1];for(let s=0;s<9;s++)e.chanLoc&1<<8-s&&(r+=i[s])}return r};var Ys=1683496997,Js=18,eo=10;var an=32,gr=20,to=8,ro=[0,8e3,16e3,32e3,0,0,11025,22050,44100,0,0,12e3,24e3,48e3,96e3,192e3],io=[32e3,56e3,64e3,96e3,112e3,128e3,192e3,224e3,256e3,32e4,384e3,448e3,512e3,576e3,64e4,768e3,96e4,1024e3,1152e3,128e4,1344e3,1408e3,1411200,1472e3,1536e3,192e4,2048e3,3072e3,384e4,0,0,0],no=[16,16,20,20,0,24,24,0],fr=[1,2,2,2,2,3,3,4,4,5,6,6,6,7,8,8],so=[1,2,2,2,2,3,18,19,6,7,518,323,83,519,582,535],oo=8,ao=44646,co=[32e3,44100,48e3,0],lo=[8e3,16e3,32e3,64e3,128e3,22050,44100,88200,176400,352800,12e3,24e3,48e3,96e3,192e3,384e3],In=[512,1024,2048,4096],li=t=>{let e=uo(t),r=H(t),i=e?Math.ceil(e.frameSize/4)*4:0,s=null;for(;i+4<=t.length&&r.getUint32(i)===Ys;){let n=fo(t.subarray(i));if(!n)break;s??=n,i+=n.frameSize}if(e)return{frameSize:s?i:e.frameSize,sampleRate:e.sampleRate,numberOfChannels:e.numberOfChannels,sampleCount:e.sampleCount,channelLayout:e.channelLayout,pcmResolution:e.pcmResolution,bitRate:e.bitRate,core:e,hasExtensions:s!==null};if(!s?.asset)return null;let{asset:o}=s;return{frameSize:i,sampleRate:o.sampleRate,numberOfChannels:o.numberOfChannels,sampleCount:o.sampleCount,channelLayout:o.channelLayout,pcmResolution:o.pcmResolution,bitRate:0,core:null,hasExtensions:!0}},vn=t=>{let e=li(t);return e?.core?e.hasExtensions?\"dtsh\":\"dtsc\":null},uo=t=>{if(t.length<Js||t[0]!==127||t[1]!==254||t[2]!==128||t[3]!==1)return null;let e=new D(t);if(e.skipBits(32),e.skipBits(1),e.readBits(5)!==an-1)return null;let r=e.readBits(1),i=e.readBits(7)+1;if(i%to!==0)return null;let s=e.readBits(14)+1;if(s<96)return null;let o=e.readBits(6);if(o>=fr.length)return null;let n=ro[e.readBits(4)];if(n===0)return null;let a=io[e.readBits(5)];if(e.readBits(1)!==0)return null;e.skipBits(4),e.skipBits(5);let c=e.readBits(2);if(c===3)return null;e.skipBits(1),r&&e.skipBits(16),e.skipBits(7);let l=no[e.readBits(3)];if(l===0)return null;let u=c!==0;return{frameSize:s,sampleRate:n,numberOfChannels:fr[o]+(u?1:0),sampleCount:i*an,channelLayout:so[o]|(u?oo:0),amode:o,lfePresent:u,bitRate:a,pcmResolution:l}},fo=t=>{if(t.length<eo||t[0]!==100||t[1]!==88||t[2]!==32||t[3]!==37)return null;let e=new D(t);e.skipBits(32),e.skipBits(8);let r=e.readBits(2),i=e.readBits(1),s=8+4*i,o=16+4*i;e.skipBits(s);let n=e.readBits(o)+1,a={frameSize:n,asset:null};if(!e.readBits(1))return a;let c=co[e.readBits(2)],l=512*(e.readBits(3)+1);e.readBits(1)&&e.skipBits(36);let u=e.readBits(3)+1,d=e.readBits(3)+1,f=[];for(let w=0;w<u;w++)f.push(e.readBits(r+1));for(let w of f)e.skipBits(8*nr(w));if(e.readBits(1)){e.skipBits(2);let w=e.readBits(2)+1<<2,A=e.readBits(2)+1;e.skipBits(A*w)}for(let w=0;w<d;w++)e.skipBits(o);e.skipBits(9),e.skipBits(3),e.readBits(1)&&e.skipBits(4),e.readBits(1)&&e.skipBits(24),e.readBits(1)&&e.skipBits(8*(e.readBits(10)+1));let h=e.readBits(5)+1,m=lo[e.readBits(4)],g=e.readBits(8)+1,y=0;if(e.readBits(1)&&(g>2&&e.skipBits(1),g>6&&e.skipBits(1),e.readBits(1))){let w=e.readBits(2)+1<<2;y=e.readBits(w)}return c===0||e.getBitsLeft()<0?a:{frameSize:n,asset:{sampleRate:m,numberOfChannels:g,sampleCount:Math.round(l*m/c),channelLayout:y,pcmResolution:h}}},Bn=t=>{if(t.length<gr)return null;let e=H(t),r=e.getUint32(0);if(r===0)return null;let i=new D(t);i.seekToByte(13);let s=i.readBits(2);i.skipBits(5);let o=i.readBits(1),n=i.readBits(6);i.skipBits(14),i.skipBits(1),i.skipBits(3);let a=i.readBits(16),c=null;return a!==0?c=ho(a):n<fr.length&&(c=fr[n]+o),{sampleRate:r,maxBitrate:e.getUint32(4),avgBitrate:e.getUint32(8),pcmSampleDepth:t[12],sampleCount:In[s],channelLayout:a,numberOfChannels:c}},Pn=t=>{let e=new Uint8Array(gr),r=H(e);r.setUint32(0,t.sampleRate),r.setUint32(4,t.bitRate),r.setUint32(8,t.bitRate),e[12]=t.pcmResolution;let i=t.core&&!t.hasExtensions?1:0,s=new D(e);return s.seekToByte(13),s.writeBits(2,Math.max(In.indexOf(t.sampleCount),0)),s.writeBits(5,i),s.writeBits(1,t.core?.lfePresent?1:0),s.writeBits(6,t.core?.amode??0),s.writeBits(14,t.core?t.core.frameSize-1:0),s.writeBits(1,0),s.writeBits(3,0),s.writeBits(16,t.channelLayout),s.writeBits(1,0),s.writeBits(1,0),s.writeBits(1,0),s.writeBits(5,0),e},ho=t=>nr(t)+nr(t&ao);var $e=[\"avc\",\"hevc\",\"vp9\",\"av1\",\"vp8\",\"prores\"],ie=[\"pcm-s16\",\"pcm-s16be\",\"pcm-s24\",\"pcm-s24be\",\"pcm-s32\",\"pcm-s32be\",\"pcm-f32\",\"pcm-f32be\",\"pcm-f64\",\"pcm-f64be\",\"pcm-u8\",\"pcm-s8\",\"ulaw\",\"alaw\"],yr=[\"aac\",\"opus\",\"mp3\",\"vorbis\",\"flac\",\"ac3\",\"eac3\",\"dts\"],At=[...yr,...ie],ot=[\"webvtt\"],ni=[{maxMacroblocks:99,maxBitrate:64e3,maxDpbMbs:396,level:10},{maxMacroblocks:396,maxBitrate:192e3,maxDpbMbs:900,level:11},{maxMacroblocks:396,maxBitrate:384e3,maxDpbMbs:2376,level:12},{maxMacroblocks:396,maxBitrate:768e3,maxDpbMbs:2376,level:13},{maxMacroblocks:396,maxBitrate:2e6,maxDpbMbs:2376,level:20},{maxMacroblocks:792,maxBitrate:4e6,maxDpbMbs:4752,level:21},{maxMacroblocks:1620,maxBitrate:4e6,maxDpbMbs:8100,level:22},{maxMacroblocks:1620,maxBitrate:1e7,maxDpbMbs:8100,level:30},{maxMacroblocks:3600,maxBitrate:14e6,maxDpbMbs:18e3,level:31},{maxMacroblocks:5120,maxBitrate:2e7,maxDpbMbs:20480,level:32},{maxMacroblocks:8192,maxBitrate:2e7,maxDpbMbs:32768,level:40},{maxMacroblocks:8192,maxBitrate:5e7,maxDpbMbs:32768,level:41},{maxMacroblocks:8704,maxBitrate:5e7,maxDpbMbs:34816,level:42},{maxMacroblocks:22080,maxBitrate:135e6,maxDpbMbs:110400,level:50},{maxMacroblocks:36864,maxBitrate:24e7,maxDpbMbs:184320,level:51},{maxMacroblocks:36864,maxBitrate:24e7,maxDpbMbs:184320,level:52},{maxMacroblocks:139264,maxBitrate:24e7,maxDpbMbs:696320,level:60},{maxMacroblocks:139264,maxBitrate:48e7,maxDpbMbs:696320,level:61},{maxMacroblocks:139264,maxBitrate:8e8,maxDpbMbs:696320,level:62}];var nt=[{maxPictureSize:36864,maxBitrate:2e5,level:10},{maxPictureSize:73728,maxBitrate:8e5,level:11},{maxPictureSize:122880,maxBitrate:18e5,level:20},{maxPictureSize:245760,maxBitrate:36e5,level:21},{maxPictureSize:552960,maxBitrate:72e5,level:30},{maxPictureSize:983040,maxBitrate:12e6,level:31},{maxPictureSize:2228224,maxBitrate:18e6,level:40},{maxPictureSize:2228224,maxBitrate:3e7,level:41},{maxPictureSize:8912896,maxBitrate:6e7,level:50},{maxPictureSize:8912896,maxBitrate:12e7,level:51},{maxPictureSize:8912896,maxBitrate:18e7,level:52},{maxPictureSize:35651584,maxBitrate:18e7,level:60},{maxPictureSize:35651584,maxBitrate:24e7,level:61},{maxPictureSize:35651584,maxBitrate:48e7,level:62}];var Rn=\".01.01.01.01.00\",Fn=\".0.110.01.01.01.0\",st=[\"ap4x\",\"ap4h\",\"apch\",\"apcn\",\"apcs\",\"apco\"],$t=[\"dtsc\",\"dtsh\",\"dtsl\",\"dtse\"];var Mn=t=>{let e=t.split(\".\"),s=(1<<7)+1,o=Number(e[1]),n=e[2],a=Number(n.slice(0,-1)),c=(o<<5)+a,l=n.slice(-1)===\"H\"?1:0,u=Number(e[3]),d=u===8?0:1,f=u===12?1:0,h=e[4]?Number(e[4]):0,m=e[5]?Number(e[5][0]):1,g=e[5]?Number(e[5][1]):1,y=e[5]?Number(e[5][2]):0,w=(l<<7)+(d<<6)+(f<<5)+(h<<4)+(m<<3)+(g<<2)+y;return[s,c,w,0]},On=t=>{let{codec:e,codecDescription:r,colorSpace:i,avcCodecInfo:s,hevcCodecInfo:o,vp9CodecInfo:n,av1CodecInfo:a,proresFormat:c}=t;if(e===\"avc\"){if(p(t.avcType!==null),s){let l=new Uint8Array([s.avcProfileIndication,s.profileCompatibility,s.avcLevelIndication]);return`avc${t.avcType}.${je(l)}`}if(!r||r.byteLength<4)throw new TypeError(\"AVC decoder description is not provided or is not at least 4 bytes long.\");return`avc${t.avcType}.${je(r.subarray(1,4))}`}else if(e===\"hevc\"){let l,u,d,f,h,m;if(o)l=o.generalProfileSpace,u=o.generalProfileIdc,d=Kr(o.generalProfileCompatibilityFlags),f=o.generalTierFlag,h=o.generalLevelIdc,m=[...o.generalConstraintIndicatorFlags];else{if(!r||r.byteLength<23)throw new TypeError(\"HEVC decoder description is not provided or is not at least 23 bytes long.\");let y=H(r),w=y.getUint8(1);l=w>>6&3,u=w&31,d=Kr(y.getUint32(2)),f=w>>5&1,h=y.getUint8(12),m=[];for(let A=0;A<6;A++)m.push(y.getUint8(6+A))}let g=\"hev1.\";for(g+=[\"\",\"A\",\"B\",\"C\"][l]+u,g+=\".\",g+=d.toString(16).toUpperCase(),g+=\".\",g+=f===0?\"L\":\"H\",g+=h;m.length>0&&m[m.length-1]===0;)m.pop();return m.length>0&&(g+=\".\",g+=m.map(y=>y.toString(16).toUpperCase()).join(\".\")),g}else{if(e===\"vp8\")return\"vp8\";if(e===\"vp9\"){if(!n){let A=t.width*t.height,x=Z(nt).level;for(let v of nt)if(A<=v.maxPictureSize){x=v.level;break}return`vp09.00.${x.toString().padStart(2,\"0\")}.08`}let l=n.profile.toString().padStart(2,\"0\"),u=n.level.toString().padStart(2,\"0\"),d=n.bitDepth.toString().padStart(2,\"0\"),f=n.chromaSubsampling.toString().padStart(2,\"0\"),h=n.colourPrimaries.toString().padStart(2,\"0\"),m=n.transferCharacteristics.toString().padStart(2,\"0\"),g=n.matrixCoefficients.toString().padStart(2,\"0\"),y=n.videoFullRangeFlag.toString().padStart(2,\"0\"),w=`vp09.${l}.${u}.${d}.${f}`;return w+=`.${h}.${m}.${g}.${y}`,w.endsWith(Rn)&&(w=w.slice(0,-Rn.length)),w}else if(e===\"av1\"){if(!a){let v=t.width*t.height,U=Z(nt).level;for(let M of nt)if(v<=M.maxPictureSize){U=M.level;break}return`av01.0.${U.toString().padStart(2,\"0\")}M.08`}let l=a.profile,u=a.level.toString().padStart(2,\"0\"),d=a.tier?\"H\":\"M\",f=a.bitDepth.toString().padStart(2,\"0\"),h=a.monochrome?\"1\":\"0\",m=100*a.chromaSubsamplingX+10*a.chromaSubsamplingY+1*(a.chromaSubsamplingX&&a.chromaSubsamplingY?a.chromaSamplePosition:0),g=i?.primaries?et[i.primaries]:1,y=i?.transfer?tt[i.transfer]:1,w=i?.matrix?rt[i.matrix]:1,A=i?.fullRange?1:0,x=`av01.${l}.${u}${d}.${f}`;return x+=`.${h}.${m.toString().padStart(3,\"0\")}`,x+=`.${g.toString().padStart(2,\"0\")}`,x+=`.${y.toString().padStart(2,\"0\")}`,x+=`.${w.toString().padStart(2,\"0\")}`,x+=`.${A}`,x.endsWith(Fn)&&(x=x.slice(0,-Fn.length)),x}else{if(e===\"prores\")return c??\"apch\";e!==null&&Pe(e)}}throw new TypeError(`Unhandled codec '${e}'.`)},zn=t=>{switch(t.codec){case\"avc\":{let e=t.avcCodecInfo?.sequenceParameterSets[0];if(!e&&t.codecDescription&&(e=fn(t.codecDescription)?.sequenceParameterSets[0]),e){let r=si(e);if(r)return{primaries:qe[r.colourPrimaries],transfer:He[r.transferCharacteristics],matrix:Qe[r.matrixCoefficients],fullRange:!!r.fullRangeFlag}}}break;case\"hevc\":{let e=t.hevcCodecInfo?.arrays.find(r=>r.nalUnitType===re.SPS_NUT)?.nalUnits[0];if(!e&&t.codecDescription&&(e=pn(t.codecDescription)?.arrays.find(r=>r.nalUnitType===re.SPS_NUT)?.nalUnits[0]),e){let r=oi(e);if(r)return{primaries:qe[r.colourPrimaries],transfer:He[r.transferCharacteristics],matrix:Qe[r.matrixCoefficients],fullRange:!!r.fullRangeFlag}}}break;case\"vp8\":break;case\"vp9\":if(t.vp9CodecInfo)return{primaries:qe[t.vp9CodecInfo.colourPrimaries],transfer:He[t.vp9CodecInfo.transferCharacteristics],matrix:Qe[t.vp9CodecInfo.matrixCoefficients],fullRange:!!t.vp9CodecInfo.videoFullRangeFlag};break;case\"av1\":if(t.av1CodecInfo)return{primaries:qe[t.av1CodecInfo.colourPrimaries],transfer:He[t.av1CodecInfo.transferCharacteristics],matrix:Qe[t.av1CodecInfo.matrixCoefficients],fullRange:!!t.av1CodecInfo.videoFullRangeFlag};break;case\"prores\":if(t.proresCodecInfo)return{primaries:qe[t.proresCodecInfo.colourPrimaries],transfer:He[t.proresCodecInfo.transferCharacteristics],matrix:Qe[t.proresCodecInfo.matrixCoefficients],fullRange:t.proresCodecInfo.fullRange};break}return{primaries:void 0,transfer:void 0,matrix:void 0,fullRange:void 0}};var Dn=t=>{let{codec:e,codecDescription:r,aacCodecInfo:i,dtsFormat:s}=t;if(e===\"aac\"){if(!i)throw new TypeError(\"AAC codec info must be provided.\");if(i.isMpeg2)return\"mp4a.67\";{let o;return i.objectType!==null?o=i.objectType:o=ur(r).objectType,`mp4a.40.${o}`}}else{if(e===\"mp3\")return\"mp3\";if(e===\"opus\")return\"opus\";if(e===\"vorbis\")return\"vorbis\";if(e===\"flac\")return\"flac\";if(e===\"ac3\")return\"ac-3\";if(e===\"eac3\")return\"ec-3\";if(e===\"dts\")return s??\"dtsc\";if(e&&ie.includes(e))return e}throw new TypeError(`Unhandled codec '${e}'.`)};var Un=48e3,Ln=/^pcm-([usf])(\\d+)(be)?$/,we=t=>{if(p(ie.includes(t)),t===\"ulaw\")return{dataType:\"ulaw\",sampleSize:1,littleEndian:!0,silentValue:255};if(t===\"alaw\")return{dataType:\"alaw\",sampleSize:1,littleEndian:!0,silentValue:213};let e=Ln.exec(t);p(e);let r;e[1]===\"u\"?r=\"unsigned\":e[1]===\"s\"?r=\"signed\":r=\"float\";let i=Number(e[2])/8,s=e[3]!==\"be\",o=t===\"pcm-u8\"?2**7:0;return{dataType:r,sampleSize:i,littleEndian:s,silentValue:o}},Vn=t=>t.startsWith(\"avc1\")||t.startsWith(\"avc3\")?\"avc\":t.startsWith(\"hev1\")||t.startsWith(\"hvc1\")?\"hevc\":t===\"vp8\"?\"vp8\":t.startsWith(\"vp09\")?\"vp9\":t.startsWith(\"av01\")?\"av1\":st.includes(t)?\"prores\":t===\"mp3\"||t===\"mp4a.69\"||t===\"mp4a.6B\"||t===\"mp4a.6b\"||t===\"mp4a.40.34\"?\"mp3\":t.startsWith(\"mp4a.40.\")||t===\"mp4a.67\"?\"aac\":t===\"opus\"?\"opus\":t===\"vorbis\"?\"vorbis\":t===\"flac\"?\"flac\":t===\"ac-3\"||t===\"ac3\"?\"ac3\":t===\"ec-3\"||t===\"eac3\"?\"eac3\":$t.includes(t)?\"dts\":t===\"ulaw\"?\"ulaw\":t===\"alaw\"?\"alaw\":Ln.test(t)?t:t===\"webvtt\"?\"webvtt\":null;var mo=[\"avc1\",\"avc3\",\"hev1\",\"hvc1\",\"vp8\",\"vp09\",\"av01\",...st],po=/^(avc1|avc3)\\.[0-9a-fA-F]{6}$/,go=/^(hev1|hvc1)\\.(?:[ABC]?\\d+)\\.[0-9a-fA-F]{1,8}\\.[LH]\\d+(?:\\.[0-9a-fA-F]{1,2}){0,6}$/,yo=/^vp09(?:\\.\\d{2}){3}(?:(?:\\.\\d{2}){5})?$/,wo=/^av01\\.\\d\\.\\d{2}[MH]\\.\\d{2}(?:\\.\\d\\.\\d{3}\\.\\d{2}\\.\\d{2}\\.\\d{2}\\.\\d)?$/,wr=(t,e)=>{if(!t)throw new TypeError(\"Video chunk metadata must be provided.\");if(typeof t!=\"object\")throw new TypeError(\"Video chunk metadata must be an object.\");if(!t.decoderConfig)throw new TypeError(\"Video chunk metadata must include a decoder configuration.\");if(typeof t.decoderConfig!=\"object\")throw new TypeError(\"Video chunk metadata decoder configuration must be an object.\");if(typeof t.decoderConfig.codec!=\"string\")throw new TypeError(\"Video chunk metadata decoder configuration must specify a codec string.\");if(!mo.some(r=>t.decoderConfig.codec.startsWith(r)))throw new TypeError(\"Video chunk metadata decoder configuration codec string must be a valid video codec string as specified in the Mediabunny Codec Registry.\");if(!Number.isInteger(t.decoderConfig.codedWidth)||t.decoderConfig.codedWidth<=0)throw new TypeError(\"Video chunk metadata decoder configuration must specify a valid codedWidth (positive integer).\");if(!Number.isInteger(t.decoderConfig.codedHeight)||t.decoderConfig.codedHeight<=0)throw new TypeError(\"Video chunk metadata decoder configuration must specify a valid codedHeight (positive integer).\");if(t.decoderConfig.displayAspectWidth!==void 0&&(!Number.isInteger(t.decoderConfig.displayAspectWidth)||t.decoderConfig.displayAspectWidth<=0))throw new TypeError(\"Video chunk metadata decoder configuration displayAspectWidth, when defined, must be a positive integer.\");if(t.decoderConfig.displayAspectHeight!==void 0&&(!Number.isInteger(t.decoderConfig.displayAspectHeight)||t.decoderConfig.displayAspectHeight<=0))throw new TypeError(\"Video chunk metadata decoder configuration displayAspectHeight, when defined, must be a positive integer.\");if(t.decoderConfig.displayAspectWidth!==void 0!=(t.decoderConfig.displayAspectHeight!==void 0))throw new TypeError(\"Video chunk metadata decoder configuration must specify both displayAspectWidth and displayAspectHeight, or neither.\");if(t.decoderConfig.description!==void 0&&!jr(t.decoderConfig.description))throw new TypeError(\"Video chunk metadata decoder configuration description, when defined, must be an ArrayBuffer or an ArrayBuffer view.\");if(t.decoderConfig.colorSpace!==void 0){let{colorSpace:r}=t.decoderConfig;if(typeof r!=\"object\")throw new TypeError(\"Video chunk metadata decoder configuration colorSpace, when provided, must be an object.\");let i=Object.keys(et);if(r.primaries!=null&&!i.includes(r.primaries))throw new TypeError(`Video chunk metadata decoder configuration colorSpace primaries, when defined, must be one of ${i.join(\", \")}.`);let s=Object.keys(tt);if(r.transfer!=null&&!s.includes(r.transfer))throw new TypeError(`Video chunk metadata decoder configuration colorSpace transfer, when defined, must be one of ${s.join(\", \")}.`);let o=Object.keys(rt);if(r.matrix!=null&&!o.includes(r.matrix))throw new TypeError(`Video chunk metadata decoder configuration colorSpace matrix, when defined, must be one of ${o.join(\", \")}.`);if(r.fullRange!=null&&typeof r.fullRange!=\"boolean\")throw new TypeError(\"Video chunk metadata decoder configuration colorSpace fullRange, when defined, must be a boolean.\")}if(t.decoderConfig.codec.startsWith(\"avc1\")||t.decoderConfig.codec.startsWith(\"avc3\")){if(!po.test(t.decoderConfig.codec))throw new TypeError(\"Video chunk metadata decoder configuration codec string for AVC must be a valid AVC codec string as specified in Section 3.4 of RFC 6381.\")}else if(t.decoderConfig.codec.startsWith(\"hev1\")||t.decoderConfig.codec.startsWith(\"hvc1\")){if(!go.test(t.decoderConfig.codec))throw new TypeError(\"Video chunk metadata decoder configuration codec string for HEVC must be a valid HEVC codec string as specified in Section E.3 of ISO 14496-15.\")}else if(t.decoderConfig.codec.startsWith(\"vp8\")){if(t.decoderConfig.codec!==\"vp8\")throw new TypeError('Video chunk metadata decoder configuration codec string for VP8 must be \"vp8\".')}else if(t.decoderConfig.codec.startsWith(\"vp09\")){if(!yo.test(t.decoderConfig.codec))throw new TypeError('Video chunk metadata decoder configuration codec string for VP9 must be a valid VP9 codec string as specified in Section \"Codecs Parameter String\" of https://www.webmproject.org/vp9/mp4/.')}else if(t.decoderConfig.codec.startsWith(\"av01\")){if(!wo.test(t.decoderConfig.codec))throw new TypeError('Video chunk metadata decoder configuration codec string for AV1 must be a valid AV1 codec string as specified in Section \"Codecs Parameter String\" of https://aomediacodec.github.io/av1-isobmff/.')}else if(st.some(r=>t.decoderConfig.codec.startsWith(r))&&!st.some(r=>t.decoderConfig.codec===r))throw new TypeError(`Video chunk metadata decoder configuration codec string for ProRes must be one of the valid ProRes four-character codes: ${st.join(\", \")}.`);if(e!==null&&Vn(t.decoderConfig.codec)!==e)throw new TypeError(`Video chunk metadata decoder configuration codec string '${t.decoderConfig.codec}' does not fit to the track codec '${e}'.`)},Ao=[\"mp4a\",\"mp3\",\"opus\",\"vorbis\",\"flac\",\"ulaw\",\"alaw\",\"pcm\",\"ac-3\",\"ec-3\",\"dts\"],Ar=(t,e)=>{if(!t)throw new TypeError(\"Audio chunk metadata must be provided.\");if(typeof t!=\"object\")throw new TypeError(\"Audio chunk metadata must be an object.\");if(!t.decoderConfig)throw new TypeError(\"Audio chunk metadata must include a decoder configuration.\");if(typeof t.decoderConfig!=\"object\")throw new TypeError(\"Audio chunk metadata decoder configuration must be an object.\");if(typeof t.decoderConfig.codec!=\"string\")throw new TypeError(\"Audio chunk metadata decoder configuration must specify a codec string.\");if(!Ao.some(r=>t.decoderConfig.codec.startsWith(r)))throw new TypeError(\"Audio chunk metadata decoder configuration codec string must be a valid audio codec string as specified in the Mediabunny Codec Registry.\");if(!Number.isInteger(t.decoderConfig.sampleRate)||t.decoderConfig.sampleRate<=0)throw new TypeError(\"Audio chunk metadata decoder configuration must specify a valid sampleRate (positive integer).\");if(!Number.isInteger(t.decoderConfig.numberOfChannels)||t.decoderConfig.numberOfChannels<=0)throw new TypeError(\"Audio chunk metadata decoder configuration must specify a valid numberOfChannels (positive integer).\");if(t.decoderConfig.description!==void 0&&!jr(t.decoderConfig.description))throw new TypeError(\"Audio chunk metadata decoder configuration description, when defined, must be an ArrayBuffer or an ArrayBuffer view.\");if(t.decoderConfig.codec.startsWith(\"mp4a\")&&t.decoderConfig.codec!==\"mp4a.69\"&&t.decoderConfig.codec!==\"mp4a.6B\"&&t.decoderConfig.codec!==\"mp4a.6b\"){if(![\"mp4a.40.2\",\"mp4a.40.02\",\"mp4a.40.5\",\"mp4a.40.05\",\"mp4a.40.29\",\"mp4a.67\"].includes(t.decoderConfig.codec))throw new TypeError(\"Audio chunk metadata decoder configuration codec string for AAC must be a valid AAC codec string as specified in https://www.w3.org/TR/webcodecs-aac-codec-registration/.\")}else if(t.decoderConfig.codec.startsWith(\"mp3\")||t.decoderConfig.codec.startsWith(\"mp4a\")){if(t.decoderConfig.codec!==\"mp3\"&&t.decoderConfig.codec!==\"mp4a.69\"&&t.decoderConfig.codec!==\"mp4a.6B\"&&t.decoderConfig.codec!==\"mp4a.6b\")throw new TypeError('Audio chunk metadata decoder configuration codec string for MP3 must be \"mp3\", \"mp4a.69\" or \"mp4a.6B\".')}else if(t.decoderConfig.codec.startsWith(\"opus\")){if(t.decoderConfig.codec!==\"opus\")throw new TypeError('Audio chunk metadata decoder configuration codec string for Opus must be \"opus\".');if(t.decoderConfig.description&&t.decoderConfig.description.byteLength<18)throw new TypeError(\"Audio chunk metadata decoder configuration description, when specified, is expected to be an Identification Header as specified in Section 5.1 of RFC 7845.\")}else if(t.decoderConfig.codec.startsWith(\"vorbis\")){if(t.decoderConfig.codec!==\"vorbis\")throw new TypeError('Audio chunk metadata decoder configuration codec string for Vorbis must be \"vorbis\".');if(!t.decoderConfig.description)throw new TypeError(\"Audio chunk metadata decoder configuration for Vorbis must include a description, which is expected to adhere to the format described in https://www.w3.org/TR/webcodecs-vorbis-codec-registration/.\")}else if(t.decoderConfig.codec.startsWith(\"flac\")){if(t.decoderConfig.codec!==\"flac\")throw new TypeError('Audio chunk metadata decoder configuration codec string for FLAC must be \"flac\".');if(!t.decoderConfig.description||t.decoderConfig.description.byteLength<42)throw new TypeError(\"Audio chunk metadata decoder configuration for FLAC must include a description, which is expected to adhere to the format described in https://www.w3.org/TR/webcodecs-flac-codec-registration/.\")}else if(t.decoderConfig.codec.startsWith(\"ac-3\")||t.decoderConfig.codec.startsWith(\"ac3\")){if(t.decoderConfig.codec!==\"ac-3\")throw new TypeError('Audio chunk metadata decoder configuration codec string for AC-3 must be \"ac-3\".')}else if(t.decoderConfig.codec.startsWith(\"ec-3\")||t.decoderConfig.codec.startsWith(\"eac3\")){if(t.decoderConfig.codec!==\"ec-3\")throw new TypeError('Audio chunk metadata decoder configuration codec string for EC-3 must be \"ec-3\".')}else if(t.decoderConfig.codec.startsWith(\"dts\")){if(!$t.includes(t.decoderConfig.codec))throw new TypeError(`Audio chunk metadata decoder configuration codec string for DTS must be one of the following four-character codes: ${$t.join(\", \")}.`)}else if((t.decoderConfig.codec.startsWith(\"pcm\")||t.decoderConfig.codec.startsWith(\"ulaw\")||t.decoderConfig.codec.startsWith(\"alaw\"))&&!ie.includes(t.decoderConfig.codec))throw new TypeError(`Audio chunk metadata decoder configuration codec string for PCM must be one of the supported PCM codecs (${ie.join(\", \")}).`);if(e!==null&&Vn(t.decoderConfig.codec)!==e)throw new TypeError(`Audio chunk metadata decoder configuration codec string '${t.decoderConfig.codec}' does not fit to the track codec '${e}'.`)},Wn=t=>{if(!t)throw new TypeError(\"Subtitle metadata must be provided.\");if(typeof t!=\"object\")throw new TypeError(\"Subtitle metadata must be an object.\");if(!t.config)throw new TypeError(\"Subtitle metadata must include a config object.\");if(typeof t.config!=\"object\")throw new TypeError(\"Subtitle metadata config must be an object.\");if(typeof t.config.description!=\"string\")throw new TypeError(\"Subtitle metadata config description must be a string.\")};var br=class{constructor(e){this.input=e}dispose(){}};var Gt=new Uint8Array(0),G=class t{constructor(e,r,i,s,o=-1,n,a){if(this.data=e,this.type=r,this.timestamp=i,this.duration=s,this.sequenceNumber=o,e===Gt&&n===void 0)throw new Error(\"Internal error: byteLength must be explicitly provided when constructing metadata-only packets.\");if(n===void 0&&(n=e.byteLength),!(e instanceof Uint8Array))throw new TypeError(\"data must be a Uint8Array.\");if(r!==\"key\"&&r!==\"delta\")throw new TypeError('type must be either \"key\" or \"delta\".');if(!Number.isFinite(i))throw new TypeError(\"timestamp must be a number.\");if(!Number.isFinite(s)||s<0)throw new TypeError(\"duration must be a non-negative number.\");if(!Number.isFinite(o))throw new TypeError(\"sequenceNumber must be a number.\");if(!Number.isInteger(n)||n<0)throw new TypeError(\"byteLength must be a non-negative integer.\");if(a!==void 0&&(typeof a!=\"object\"||!a))throw new TypeError(\"sideData, when provided, must be an object.\");if(a?.alpha!==void 0&&!(a.alpha instanceof Uint8Array))throw new TypeError(\"sideData.alpha, when provided, must be a Uint8Array.\");if(a?.alphaByteLength!==void 0&&(!Number.isInteger(a.alphaByteLength)||a.alphaByteLength<0))throw new TypeError(\"sideData.alphaByteLength, when provided, must be a non-negative integer.\");this.byteLength=n,this.sideData=a??{},this.sideData.alpha&&this.sideData.alphaByteLength===void 0&&(this.sideData.alphaByteLength=this.sideData.alpha.byteLength)}get isMetadataOnly(){return this.data===Gt}get microsecondTimestamp(){return Math.trunc(Xr*this.timestamp)}get microsecondDuration(){return Math.trunc(Xr*this.duration)}toEncodedVideoChunk(){if(this.isMetadataOnly)throw new TypeError(\"Metadata-only packets cannot be converted to a video chunk.\");if(typeof EncodedVideoChunk>\"u\")throw new Error(\"EncodedVideoChunk is not available in this environment.\");return new EncodedVideoChunk({data:this.data,type:this.type,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}alphaToEncodedVideoChunk(e=this.type){if(!this.sideData.alpha)throw new TypeError(\"This packet does not contain alpha side data.\");if(this.isMetadataOnly)throw new TypeError(\"Metadata-only packets cannot be converted to a video chunk.\");if(typeof EncodedVideoChunk>\"u\")throw new Error(\"EncodedVideoChunk is not available in this environment.\");return new EncodedVideoChunk({data:this.sideData.alpha,type:e,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}toEncodedAudioChunk(){if(this.isMetadataOnly)throw new TypeError(\"Metadata-only packets cannot be converted to an audio chunk.\");if(typeof EncodedAudioChunk>\"u\")throw new Error(\"EncodedAudioChunk is not available in this environment.\");return new EncodedAudioChunk({data:this.data,type:this.type,timestamp:this.microsecondTimestamp,duration:this.microsecondDuration})}static fromEncodedChunk(e,r){if(!(e instanceof EncodedVideoChunk||e instanceof EncodedAudioChunk))throw new TypeError(\"chunk must be an EncodedVideoChunk or EncodedAudioChunk.\");let i=new Uint8Array(e.byteLength);return e.copyTo(i),new t(i,e.type,e.timestamp/1e6,(e.duration??0)/1e6,void 0,void 0,r)}clone(e){if(e!==void 0&&(typeof e!=\"object\"||e===null))throw new TypeError(\"options, when provided, must be an object.\");if(e?.data!==void 0&&!(e.data instanceof Uint8Array))throw new TypeError(\"options.data, when provided, must be a Uint8Array.\");if(e?.type!==void 0&&e.type!==\"key\"&&e.type!==\"delta\")throw new TypeError('options.type, when provided, must be either \"key\" or \"delta\".');if(e?.timestamp!==void 0&&!Number.isFinite(e.timestamp))throw new TypeError(\"options.timestamp, when provided, must be a number.\");if(e?.duration!==void 0&&!Number.isFinite(e.duration))throw new TypeError(\"options.duration, when provided, must be a number.\");if(e?.sequenceNumber!==void 0&&!Number.isFinite(e.sequenceNumber))throw new TypeError(\"options.sequenceNumber, when provided, must be a number.\");if(e?.sideData!==void 0&&(typeof e.sideData!=\"object\"||e.sideData===null))throw new TypeError(\"options.sideData, when provided, must be an object.\");return new t(e?.data??this.data,e?.type??this.type,e?.timestamp??this.timestamp,e?.duration??this.duration,e?.sequenceNumber??this.sequenceNumber,this.byteLength,e?.sideData??this.sideData)}};var xr=t=>{let r=(t.hasVideo?\"video/\":t.hasAudio?\"audio/\":\"application/\")+(t.isQuickTime?\"quicktime\":\"mp4\");if(t.codecStrings.length>0){let i=[...new Set(t.codecStrings)];r+=`; codecs=\"${i.join(\", \")}\"`}return r},Nn=t=>{let e=H(t),r=0,i=e.getUint8(r);r+=1,r+=3;let s=je(t.subarray(r,r+16));r+=16;let o=null;if(i>0){let a=e.getUint32(r);if(r+=4,a>0){o=[];for(let c=0;c<a;c++)o.push(je(t.subarray(r,r+16))),r+=16}}let n=e.getUint32(r);return r+=4,{systemId:s,keyIds:o,data:t.slice(r,r+n)}},qn=(t,e)=>t.systemId===e.systemId&&Ki(t.data,e.data);var Ae=8,Fe=16,Me=t=>{let e=T(t),r=se(t,4),i=8;e===1&&(e=te(t),i=16);let o=e-i;return o<0?null:{name:r,totalSize:e,headerSize:i,contentSize:o}},Ge=t=>Oe(t)/65536,Tr=t=>Oe(t)/1073741824,Sr=t=>{let e=0;for(let r=0;r<4;r++){e<<=7;let i=P(t);if(e|=i&127,(i&128)===0)break}return e},be=t=>{let e=X(t);return t.skip(2),e=Math.min(e,t.remainingLength),Ne.decode(L(t,e))},Hn=t=>{let e=Me(t);if(!e||e.name!==\"data\"||t.remainingLength<8)return null;let r=T(t);t.skip(4);let i=L(t,e.contentSize-8);switch(r){case 1:return Ne.decode(i);case 2:return new qr(\"utf-16be\").decode(i);case 13:return new ye(i,\"image/jpeg\");case 14:return new ye(i,\"image/png\");case 27:return new ye(i,\"image/bmp\");default:return i}};var ui=16,ze=new Uint32Array(256),bt=new Uint32Array(256),xt=new Uint32Array(256),Tt=new Uint32Array(256),St=new Uint32Array(256),J=new Uint32Array(256),Qn=new Uint32Array(10),jn=!1,bo=()=>{let t=new Uint8Array(256),e=new Uint8Array(256),r=new Uint8Array(256);for(let o=0,n=1;o<256;o++)r[o]=n,e[n]=o,n=n^n<<1^(n&128?283:0);let i=(o,n)=>o&&n?r[(e[o]+e[n])%255]:0;t[0]=99;for(let o=1;o<256;o++){let n=r[255-e[o]],a=n^n<<1^n<<2^n<<3^n<<4;a=a>>>8^a&255^99,t[o]=a}for(let o=0;o<256;o++){let n=t[o],a=t.indexOf(o);ze[o]=n<<24|n<<16|n<<8|n,J[o]=a<<24|a<<16|a<<8|a;let c=i(a,14),l=i(a,9),u=i(a,13),d=i(a,11),f=c<<24|l<<16|u<<8|d;bt[o]=f,xt[o]=f>>>8|f<<24,Tt[o]=f>>>16|f<<16,St[o]=f>>>24|f<<8}let s=1;for(let o=0;o<10;o++)Qn[o]=s<<24,s=s<<1^(s&128?283:0);jn=!0},kr=class{constructor(){this.roundkey=new Uint32Array(44),this.iv=new Uint32Array(ui/Uint32Array.BYTES_PER_ELEMENT),this.in=new Uint8Array(ui),this.out=new Uint8Array(ui),this.inView=new DataView(this.in.buffer),this.outView=new DataView(this.out.buffer)}init({key:e,iv:r}){p(e.byteLength===16),p(r.byteLength===16),jn||bo();let i=new DataView(e.buffer,e.byteOffset,e.byteLength),s=new DataView(r.buffer,r.byteOffset,r.byteLength);this.roundkey[0]=i.getUint32(0,!1),this.roundkey[1]=i.getUint32(4,!1),this.roundkey[2]=i.getUint32(8,!1),this.roundkey[3]=i.getUint32(12,!1),this.iv[0]=s.getUint32(0,!1),this.iv[1]=s.getUint32(4,!1),this.iv[2]=s.getUint32(8,!1),this.iv[3]=s.getUint32(12,!1);for(let o=4;o<44;o+=4){let n=this.roundkey[o-1];this.roundkey[o]=this.roundkey[o-4]^ze[n>>>16&255]&4278190080^ze[n>>>8&255]&16711680^ze[n>>>0&255]&65280^ze[n>>>24&255]&255^Qn[o/4-1],this.roundkey[o+1]=this.roundkey[o-3]^this.roundkey[o],this.roundkey[o+2]=this.roundkey[o-2]^this.roundkey[o+1],this.roundkey[o+3]=this.roundkey[o-1]^this.roundkey[o+2]}for(let o=0,n=40;o<n;o+=4,n-=4)for(let a=0;a<4;a++){let c=this.roundkey[o+a];this.roundkey[o+a]=this.roundkey[n+a],this.roundkey[n+a]=c}for(let o=4;o<40;o+=4)for(let n=0;n<4;n++){let a=this.roundkey[o+n];this.roundkey[o+n]=bt[ze[a>>>24&255]&255]^xt[ze[a>>>16&255]&255]^Tt[ze[a>>>8&255]&255]^St[ze[a>>>0&255]&255]}}decrypt(){let e=this.inView.getUint32(0,!1)^this.roundkey[0],r=this.inView.getUint32(4,!1)^this.roundkey[1],i=this.inView.getUint32(8,!1)^this.roundkey[2],s=this.inView.getUint32(12,!1)^this.roundkey[3],o=this.inView.getUint32(0,!1),n=this.inView.getUint32(4,!1),a=this.inView.getUint32(8,!1),c=this.inView.getUint32(12,!1),l,u,d,f;for(let w=1;w<10;w++){let A=w*4;l=bt[e>>>24]^xt[s>>>16&255]^Tt[i>>>8&255]^St[r&255]^this.roundkey[A],u=bt[r>>>24]^xt[e>>>16&255]^Tt[s>>>8&255]^St[i&255]^this.roundkey[A+1],d=bt[i>>>24]^xt[r>>>16&255]^Tt[e>>>8&255]^St[s&255]^this.roundkey[A+2],f=bt[s>>>24]^xt[i>>>16&255]^Tt[r>>>8&255]^St[e&255]^this.roundkey[A+3],e=l,r=u,i=d,s=f}let h=J[e>>>24&255]&4278190080^J[s>>>16&255]&16711680^J[i>>>8&255]&65280^J[r>>>0&255]&255^this.roundkey[40],m=J[r>>>24&255]&4278190080^J[e>>>16&255]&16711680^J[s>>>8&255]&65280^J[i>>>0&255]&255^this.roundkey[41],g=J[i>>>24&255]&4278190080^J[r>>>16&255]&16711680^J[e>>>8&255]&65280^J[s>>>0&255]&255^this.roundkey[42],y=J[s>>>24&255]&4278190080^J[i>>>16&255]&16711680^J[r>>>8&255]&65280^J[e>>>0&255]&255^this.roundkey[43];this.outView.setUint32(0,h^this.iv[0],!1),this.outView.setUint32(4,m^this.iv[1],!1),this.outView.setUint32(8,g^this.iv[2],!1),this.outView.setUint32(12,y^this.iv[3],!1),this.iv[0]=o,this.iv[1]=n,this.iv[2]=a,this.iv[3]=c}};var _r=class t extends br{constructor(e){super(e),this.moovSlice=null,this.currentTrack=null,this.tracks=[],this.metadataPromise=null,this.movieTimescale=-1,this.movieDurationInTimescale=-1,this.movieMatrix=pt,this.isQuickTime=!1,this.metadataTags={},this.currentMetadataKeys=null,this.isFragmented=!1,this.fragmentTrackDefaults=[],this.psshBoxes=[],this.currentFragment=null,this.lastReadFragment=null,this.decryptionKeyCache=new Map,this.reader=e._reader}async getTrackBackings(){return await this.readMetadata(),this.tracks.map(e=>e.trackBacking)}async getMimeType(){await this.readMetadata();let e=await this.getTrackBackings(),r=await Promise.all(e.map(i=>i.getDecoderConfig().then(s=>s?.codec??null)));return xr({isQuickTime:this.isQuickTime,hasVideo:this.tracks.some(i=>i.info?.type===\"video\"),hasAudio:this.tracks.some(i=>i.info?.type===\"audio\"),codecStrings:r.filter(Boolean)})}async getMetadataTags(){return await this.readMetadata(),this.metadataTags}readMetadata(){return this.metadataPromise??=(async()=>{let e=0,r=!1,i=!1;for(;;){let s=this.reader.requestSliceRange(e,Ae,Fe);if(F(s)&&(s=await s),!s)break;let o=e,n=Me(s);if(!n)break;if(n.name===\"ftyp\"||n.name===\"styp\"){let a=se(s,4);this.isQuickTime=a===\"qt  \"}else if(n.name===\"moov\"){let a=this.reader.requestSlice(s.filePos,n.contentSize);if(F(a)&&(a=await a),!a)break;this.moovSlice=a,this.readContiguousBoxes(this.moovSlice);for(let c of this.tracks){let l=c.editListPreviousSegmentDurations/this.movieTimescale;c.editListOffset-=Math.round(l*c.timescale)}r=this.isFragmented&&this.reader.fileSize!==null&&this.reader.fileSize>o+n.totalSize,i=!0;break}else if(n.name===\"moof\"){if(!this.input._initInput)throw new Error('\"moof\" box encountered with no \"moov\" box present; this file is likely a Segment as described in ISO/IEC 14496-12 Section 8.16. A separate init file that contains a \"moov\" box is required to read this file, please provide it using InputOptions.initInput.');await this.copyMetadataFromInitInput(this.input._initInput),r=!1,i=!0;break}e=o+n.totalSize}if(!i&&this.input._initInput&&await this.copyMetadataFromInitInput(this.input._initInput),r){p(this.reader.fileSize!==null);let s=this.reader.requestSlice(this.reader.fileSize-4,4);F(s)&&(s=await s),p(s);let o=T(s),n=this.reader.fileSize-o;if(n>=0&&n<=this.reader.fileSize-Fe){let a=this.reader.requestSliceRange(n,Ae,Fe);if(F(a)&&(a=await a),a){let c=Me(a);if(c&&c.name===\"mfra\"){let l=this.reader.requestSlice(a.filePos,c.contentSize);F(l)&&(l=await l),l&&this.readContiguousBoxes(l)}}}}})()}async copyMetadataFromInitInput(e){let r=await e._getDemuxer();if(r.constructor!==t)throw new Error(\"Init input must match the input's format.\");await r.readMetadata(),this.movieTimescale=r.movieTimescale,this.movieDurationInTimescale=r.movieDurationInTimescale,this.movieMatrix=r.movieMatrix,this.metadataTags=r.metadataTags,this.isFragmented=!0,this.fragmentTrackDefaults=r.fragmentTrackDefaults,this.psshBoxes=r.psshBoxes;for(let i of r.tracks){let s={id:i.id,demuxer:this,trackBacking:null,disposition:i.disposition,timescale:i.timescale,durationInMediaTimescale:i.durationInMediaTimescale,durationInMovieTimescale:i.durationInMovieTimescale,matrix:i.matrix,internalCodecId:i.internalCodecId,name:i.name,languageCode:i.languageCode,sampleTableByteOffset:null,sampleTable:null,fragmentLookupTable:[],currentFragmentState:null,fragmentPositionCache:[],editListPreviousSegmentDurations:i.editListPreviousSegmentDurations,editListOffset:i.editListOffset,encryptionInfo:i.encryptionInfo,encryptionAuxInfo:null,frmaCodecString:null,maxBitrate:i.maxBitrate,avgBitrate:i.avgBitrate,info:i.info};if(i.trackBacking){if(p(s.info),s.info.type===\"video\"&&s.info.width!==-1){let o=s;s.trackBacking=new Er(o),this.tracks.push(s)}else if(s.info.type===\"audio\"&&s.info.numberOfChannels!==-1){let o=s;s.trackBacking=new Ir(o),this.tracks.push(s)}}}}getSampleTableForTrack(e){if(e.sampleTable)return e.sampleTable;let r={sampleTimingEntries:[],sampleCompositionTimeOffsets:[],sampleSizes:[],keySampleIndices:null,chunkOffsets:[],sampleToChunk:[],presentationTimestamps:null,presentationTimestampIndexMap:null};if(e.sampleTable=r,e.sampleTableByteOffset===null)return r;p(this.moovSlice);let i=this.moovSlice.slice(e.sampleTableByteOffset);if(this.currentTrack=e,this.traverseBox(i),this.currentTrack=null,e.info?.type===\"audio\"&&e.info.codec&&ie.includes(e.info.codec)&&r.sampleCompositionTimeOffsets.length===0){p(e.info?.type===\"audio\");let o=we(e.info.codec),n=[],a=[];for(let c=0;c<r.sampleToChunk.length;c++){let l=r.sampleToChunk[c],u=r.sampleToChunk[c+1],d=(u?u.startChunkIndex:r.chunkOffsets.length)-l.startChunkIndex;for(let f=0;f<d;f++){let h=l.startSampleIndex+f*l.samplesPerChunk,m=h+l.samplesPerChunk,g=Y(r.sampleTimingEntries,h,E=>E.startIndex),y=r.sampleTimingEntries[g],w=Y(r.sampleTimingEntries,m,E=>E.startIndex),A=r.sampleTimingEntries[w],x=y.startDecodeTimestamp+(h-y.startIndex)*y.delta,U=A.startDecodeTimestamp+(m-A.startIndex)*A.delta-x,M=Z(n);M&&M.delta===U?M.count++:n.push({startIndex:l.startChunkIndex+f,startDecodeTimestamp:x,count:1,delta:U});let _=l.samplesPerChunk*o.sampleSize*e.info.numberOfChannels;a.push(_)}l.startSampleIndex=l.startChunkIndex,l.samplesPerChunk=1}r.sampleTimingEntries=n,r.sampleSizes=a}if(r.sampleCompositionTimeOffsets.length>0){r.presentationTimestamps=[];for(let o of r.sampleTimingEntries)for(let n=0;n<o.count;n++)r.presentationTimestamps.push({presentationTimestamp:o.startDecodeTimestamp+n*o.delta,sampleIndex:o.startIndex+n});for(let o of r.sampleCompositionTimeOffsets)for(let n=0;n<o.count;n++){let a=o.startIndex+n,c=r.presentationTimestamps[a];c&&(c.presentationTimestamp+=o.offset)}r.presentationTimestamps.sort((o,n)=>o.presentationTimestamp-n.presentationTimestamp),r.presentationTimestampIndexMap=Array(r.presentationTimestamps.length).fill(-1);for(let o=0;o<r.presentationTimestamps.length;o++)r.presentationTimestampIndexMap[r.presentationTimestamps[o].sampleIndex]=o}return r}async readFragment(e){if(this.lastReadFragment?.moofOffset===e)return this.lastReadFragment;let r=this.reader.requestSliceRange(e,Ae,Fe);F(r)&&(r=await r),p(r);let i=Me(r);p(i?.name===\"moof\");let s=this.reader.requestSlice(e,i.totalSize);F(s)&&(s=await s),p(s),this.traverseBox(s);let o=this.lastReadFragment;p(o&&o.moofOffset===e);for(let[,n]of o.trackData){let a=n.track,{fragmentPositionCache:c}=a;if(!n.startTimestampIsFinal){let u=a.fragmentLookupTable.find(d=>d.moofOffset===o.moofOffset);if(u)di(n,u.timestamp);else{let d=Y(c,o.moofOffset-1,f=>f.moofOffset);if(d!==-1){let f=c[d];di(n,f.endTimestamp)}}n.startTimestampIsFinal=!0}let l=Y(c,n.startTimestamp,u=>u.startTimestamp);if((l===-1||c[l].moofOffset!==o.moofOffset)&&c.splice(l+1,0,{moofOffset:o.moofOffset,startTimestamp:n.startTimestamp,endTimestamp:n.endTimestamp}),n.encryptionAuxInfo&&a.encryptionInfo){let u=await Yn(this.reader,a.encryptionInfo,n.encryptionAuxInfo);for(let d=0;d<Math.min(n.samples.length,u.length);d++){let f=u[d];n.samples[d].encryption=f}}}return o}readContiguousBoxes(e){let r=e.filePos;for(;e.filePos-r<=e.length-Ae&&this.traverseBox(e););}*iterateContiguousBoxes(e){let r=e.filePos;for(;e.filePos-r<=e.length-Ae;){let i=e.filePos,s=Me(e);if(!s)break;yield{boxInfo:s,slice:e},e.filePos=i+s.totalSize}}traverseBox(e){let r=e.filePos,i=Me(e);if(!i)return!1;let s=e.filePos,o=r+i.totalSize;switch(i.name){case\"mdia\":case\"minf\":case\"dinf\":case\"mfra\":case\"edts\":case\"sinf\":case\"schi\":this.readContiguousBoxes(e.slice(s,i.contentSize));break;case\"mvhd\":{let n=P(e);e.skip(3),n===1?(e.skip(16),this.movieTimescale=T(e),this.movieDurationInTimescale=te(e)):(e.skip(8),this.movieTimescale=T(e),this.movieDurationInTimescale=T(e)),e.skip(16),this.movieMatrix=Kn(e)}break;case\"trak\":{let n={id:-1,demuxer:this,trackBacking:null,disposition:{...Yi,primary:!1},info:null,timescale:-1,durationInMovieTimescale:-1,durationInMediaTimescale:-1,matrix:pt,internalCodecId:null,name:null,languageCode:Qt,sampleTableByteOffset:-1,sampleTable:null,fragmentLookupTable:[],currentFragmentState:null,fragmentPositionCache:[],editListPreviousSegmentDurations:0,editListOffset:0,encryptionInfo:null,encryptionAuxInfo:null,frmaCodecString:null,maxBitrate:null,avgBitrate:null};if(this.currentTrack=n,this.readContiguousBoxes(e.slice(s,i.contentSize)),n.id!==-1&&n.timescale!==-1&&n.info!==null){if(n.info.type===\"video\"&&n.info.width!==-1){let a=n;n.trackBacking=new Er(a),this.tracks.push(n)}else if(n.info.type===\"audio\"&&n.info.numberOfChannels!==-1){let a=n;n.trackBacking=new Ir(a),this.tracks.push(n)}}this.currentTrack=null}break;case\"tkhd\":{let n=this.currentTrack;if(!n)break;let a=P(e),l=!!(De(e)&1);if(n.disposition.default=l,a===0)e.skip(8),n.id=T(e),e.skip(4),n.durationInMovieTimescale=T(e);else if(a===1)e.skip(16),n.id=T(e),e.skip(4),n.durationInMovieTimescale=te(e);else throw new Error(`Incorrect track header version ${a}.`);e.skip(16);let u=Kn(e);n.matrix=ht(u,this.movieMatrix)}break;case\"elst\":{let n=this.currentTrack;if(!n)break;let a=P(e);e.skip(3);let c=!1,l=0,u=T(e);for(let d=0;d<u;d++){let f=a===1?te(e):T(e),h=a===1?ts(e):Oe(e),m=Ge(e);if(c){R._warn(\"Unsupported edit list: multiple edits are not currently supported. Only using first edit.\");break}if(h===-1){l+=f;continue}if(m!==1){R._warn(\"Unsupported edit list entry: media rate must be 1.\");break}n.editListPreviousSegmentDurations=l,n.editListOffset=h,c=!0}}break;case\"mdhd\":{let n=this.currentTrack;if(!n)break;let a=P(e);e.skip(3),a===0?(e.skip(8),n.timescale=T(e),n.durationInMediaTimescale=T(e)):a===1&&(e.skip(16),n.timescale=T(e),n.durationInMediaTimescale=te(e));let c=X(e);if(c>0){n.languageCode=\"\";for(let l=0;l<3;l++)n.languageCode=String.fromCharCode(96+(c&31))+n.languageCode,c>>=5;sr(n.languageCode)||(n.languageCode=Qt)}}break;case\"hdlr\":{let n=this.currentTrack;if(!n)break;e.skip(8);let a=se(e,4);a===\"vide\"?n.info={type:\"video\",width:-1,height:-1,squarePixelWidth:-1,squarePixelHeight:-1,codec:null,codecDescription:null,colorSpace:{...Li},avcType:null,avcCodecInfo:null,hevcCodecInfo:null,vp9CodecInfo:null,av1CodecInfo:null,proresCodecInfo:null,proresFormat:null}:a===\"soun\"&&(n.info={type:\"audio\",numberOfChannels:-1,sampleRate:-1,codec:null,codecDescription:null,aacCodecInfo:null,dtsFormat:null,pcmLittleEndian:!1,pcmSampleSize:null})}break;case\"stbl\":{let n=this.currentTrack;if(!n)break;n.sampleTableByteOffset=r,this.readContiguousBoxes(e.slice(s,i.contentSize))}break;case\"stsd\":{let n=this.currentTrack;if(!n||n.info===null||n.sampleTable)break;let a=P(e);e.skip(3);let c=T(e);for(let l=0;l<c;l++){let u=e.filePos,d=Me(e);if(!d)break;n.internalCodecId=d.name;let f=d.name.toLowerCase();if(n.info.type===\"video\"){e.skip(24),n.info.width=X(e),n.info.height=X(e),n.info.squarePixelWidth=n.info.width,n.info.squarePixelHeight=n.info.height,e.skip(50),n.frmaCodecString=null,this.readContiguousBoxes(e.slice(e.filePos,u+d.totalSize-e.filePos));let h=f===\"encv\"?n.frmaCodecString:f;n.frmaCodecString=null,h===\"avc1\"||h===\"avc3\"?(n.info.codec=\"avc\",n.info.avcType=h===\"avc1\"?1:3):h===\"hvc1\"||h===\"hev1\"?n.info.codec=\"hevc\":h===\"vp08\"?n.info.codec=\"vp8\":h===\"vp09\"?n.info.codec=\"vp9\":h===\"av01\"?n.info.codec=\"av1\":st.includes(f)?(n.info.codec=\"prores\",n.info.proresFormat=f):h===null?R._warn(\"Unknown encrypted video codec due to missing frma box.\"):R._warn(`Unsupported video codec (sample entry type '${d.name}').`)}else{e.skip(8);let h=X(e);e.skip(6);let m=X(e),g=X(e);e.skip(4);let y=T(e)/65536,w=null;a===0&&h>0&&(h===1?(e.skip(4),g=8*T(e),e.skip(8)):h===2&&(e.skip(4),y=rs(e),m=T(e),e.skip(4),g=T(e),w=T(e),e.skip(8))),n.info.numberOfChannels=m,n.info.sampleRate=y,n.frmaCodecString=null,this.readContiguousBoxes(e.slice(e.filePos,u+d.totalSize-e.filePos));let A=f===\"enca\"?n.frmaCodecString:f;if(n.frmaCodecString=null,A!==\"mp4a\")if(A===\"opus\")n.info.codec=\"opus\",n.info.sampleRate=Un;else if(A===\"flac\")n.info.codec=\"flac\";else if(A===\"ulaw\")n.info.codec=\"ulaw\";else if(A===\"alaw\")n.info.codec=\"alaw\";else if(A===\"ac-3\")n.info.codec=\"ac3\";else if(A===\"ec-3\")n.info.codec=\"eac3\";else if($t.includes(A))n.info.codec=\"dts\",n.info.dtsFormat=A;else if(A===\"twos\")g===8?n.info.codec=\"pcm-s8\":g===16?n.info.codec=n.info.pcmLittleEndian?\"pcm-s16\":\"pcm-s16be\":(R._warn(`Unsupported sample size ${g} for codec 'twos'.`),n.info.codec=null);else if(A===\"sowt\")g===8?n.info.codec=\"pcm-s8\":g===16?n.info.codec=\"pcm-s16\":(R._warn(`Unsupported sample size ${g} for codec 'sowt'.`),n.info.codec=null);else if(A===\"raw \")n.info.codec=\"pcm-u8\";else if(A===\"in24\")n.info.codec=n.info.pcmLittleEndian?\"pcm-s24\":\"pcm-s24be\";else if(A===\"in32\")n.info.codec=n.info.pcmLittleEndian?\"pcm-s32\":\"pcm-s32be\";else if(A===\"fl32\")n.info.codec=n.info.pcmLittleEndian?\"pcm-f32\":\"pcm-f32be\";else if(A===\"fl64\")n.info.codec=n.info.pcmLittleEndian?\"pcm-f64\":\"pcm-f64be\";else if(A===\"ipcm\"){let x=n.info.pcmSampleSize;n.info.pcmLittleEndian?x===16?n.info.codec=\"pcm-s16\":x===24?n.info.codec=\"pcm-s24\":x===32?n.info.codec=\"pcm-s32\":(R._warn(`Invalid ipcm sample size ${x}.`),n.info.codec=null):x===16?n.info.codec=\"pcm-s16be\":x===24?n.info.codec=\"pcm-s24be\":x===32?n.info.codec=\"pcm-s32be\":(R._warn(`Invalid ipcm sample size ${x}.`),n.info.codec=null)}else if(A===\"fpcm\"){let x=n.info.pcmSampleSize;n.info.pcmLittleEndian?x===32?n.info.codec=\"pcm-f32\":x===64?n.info.codec=\"pcm-f64\":(R._warn(`Invalid fpcm sample size ${x}.`),n.info.codec=null):x===32?n.info.codec=\"pcm-f32be\":x===64?n.info.codec=\"pcm-f64be\":(R._warn(`Invalid fpcm sample size ${x}.`),n.info.codec=null)}else if(A===\"lpcm\"&&w!==null){let x=g+7>>3,v=!!(w&1),U=!!(w&2),M=w&4?-1:0;g>0&&g<=64&&(v?g===32&&(n.info.codec=U?\"pcm-f32be\":\"pcm-f32\"):M&1<<x-1?x===1?n.info.codec=\"pcm-s8\":x===2?n.info.codec=U?\"pcm-s16be\":\"pcm-s16\":x===3?n.info.codec=U?\"pcm-s24be\":\"pcm-s24\":x===4&&(n.info.codec=U?\"pcm-s32be\":\"pcm-s32\"):x===1&&(n.info.codec=\"pcm-u8\")),n.info.codec===null&&R._warn(\"Unsupported PCM format.\")}else A===null?R._warn(\"Unknown encrypted audio codec due to missing frma box.\"):R._warn(`Unsupported audio codec (sample entry type '${d.name}').`)}e.filePos=u+d.totalSize}}break;case\"frma\":{let n=this.currentTrack;if(!n)break;let c=se(e,4).toLowerCase();n.frmaCodecString=c}break;case\"schm\":{let n=this.currentTrack;if(!n)break;e.skip(4);let a=se(e,4);a===\"cenc\"||a===\"cens\"||a===\"cbcs\"?n.encryptionInfo={scheme:a,defaultKid:null,defaultIsProtected:null,defaultPerSampleIvSize:null,defaultConstantIv:null,defaultCryptByteBlock:null,defaultSkipByteBlock:null}:R._warn(`Unsupported encryption scheme '${a}'.`)}break;case\"tenc\":{let n=this.currentTrack;if(!n||!n.encryptionInfo)break;let a=P(e);e.skip(3),e.skip(1);let c=P(e);if(a>0?(n.encryptionInfo.defaultCryptByteBlock=c>>4,n.encryptionInfo.defaultSkipByteBlock=c&15):(n.encryptionInfo.defaultCryptByteBlock=0,n.encryptionInfo.defaultSkipByteBlock=0),n.encryptionInfo.defaultIsProtected=P(e)!==0,n.encryptionInfo.defaultPerSampleIvSize=P(e),n.encryptionInfo.defaultKid=je(L(e,16)),n.encryptionInfo.defaultIsProtected&&n.encryptionInfo.defaultPerSampleIvSize===0){let l=P(e),u=new Uint8Array(16);u.set(L(e,l),0),n.encryptionInfo.defaultConstantIv=u}}break;case\"avcC\":{let n=this.currentTrack;if(!n||(p(n.info),i.contentSize===0))break;n.info.codecDescription=L(e,i.contentSize)}break;case\"hvcC\":{let n=this.currentTrack;if(!n||(p(n.info),i.contentSize===0))break;n.info.codecDescription=L(e,i.contentSize)}break;case\"vpcC\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"video\"),e.skip(4);let a=P(e),c=P(e),l=P(e),u=l>>4,d=l>>1&7,f=l&1,h=P(e),m=P(e),g=P(e);n.info.vp9CodecInfo={profile:a,level:c,bitDepth:u,chromaSubsampling:d,videoFullRangeFlag:f,colourPrimaries:h,transferCharacteristics:m,matrixCoefficients:g}}break;case\"av1C\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"video\"),e.skip(1);let a=P(e),c=a>>5,l=a&31,u=P(e),d=u>>7,f=u>>6&1,h=u>>5&1,m=u>>4&1,g=u>>3&1,y=u>>2&1,w=u&3,A=c===2&&f?h?12:10:f?10:8;e.skip(1);let x=L(e,i.contentSize-4),v=ai(x);n.info.av1CodecInfo={profile:c,level:l,tier:d,bitDepth:A,monochrome:m,chromaSubsamplingX:g,chromaSubsamplingY:y,chromaSamplePosition:w,videoFullRangeFlag:v?.videoFullRangeFlag??0,colourPrimaries:v?.colourPrimaries??2,transferCharacteristics:v?.transferCharacteristics??2,matrixCoefficients:v?.matrixCoefficients??2}}break;case\"colr\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"video\");let a=se(e,4);if(a!==\"nclx\"&&a!==\"nclc\")break;let c=X(e),l=X(e),u=X(e),d;a===\"nclx\"&&(d=!!(P(e)&128)),n.info.colorSpace={primaries:qe[c],transfer:He[l],matrix:Qe[u],fullRange:d}}break;case\"pasp\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"video\");let a=T(e),c=T(e);a>0&&c>0&&(a>c?n.info.squarePixelWidth=Math.round(n.info.width*a/c):n.info.squarePixelHeight=Math.round(n.info.height*c/a))}break;case\"btrt\":{let n=this.currentTrack;if(!n)break;e.skip(4);let a=T(e),c=T(e);n.maxBitrate=a>0?a:null,n.avgBitrate=c>0?c:null}break;case\"wave\":this.readContiguousBoxes(e.slice(s,i.contentSize));break;case\"esds\":{let n=this.currentTrack;if(!n||n.info?.type!==\"audio\")break;e.skip(4);let a=P(e);p(a===3),Sr(e),e.skip(2);let c=P(e),l=(c&128)!==0,u=(c&64)!==0,d=(c&32)!==0;if(l&&e.skip(2),u){let y=P(e);e.skip(y)}d&&e.skip(2);let f=P(e);p(f===4);let h=Sr(e),m=e.filePos,g=P(e);if(g===64||g===103?(n.info.codec=\"aac\",n.info.aacCodecInfo={isMpeg2:g===103,objectType:null}):g===105||g===107?n.info.codec=\"mp3\":g===221?n.info.codec=\"vorbis\":g===169?n.info.codec=\"dts\":R._warn(`Unsupported audio codec (objectTypeIndication ${g}) - discarding track.`),e.skip(12),h>e.filePos-m){let y=P(e);p(y===5);let w=Sr(e);if(n.info.codecDescription=L(e,w),n.info.codec===\"aac\"){let A=ur(n.info.codecDescription);A.outputNumberOfChannels!==null&&(n.info.numberOfChannels=A.outputNumberOfChannels),A.outputSampleRate!==null&&(n.info.sampleRate=A.outputSampleRate)}}}break;case\"enda\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"audio\"),n.info.pcmLittleEndian=!!(X(e)&255)}break;case\"pcmC\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"audio\"),e.skip(4);let a=P(e);n.info.pcmLittleEndian=!!(a&1),n.info.pcmSampleSize=P(e)}break;case\"dOps\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"audio\"),e.skip(1);let a=P(e),c=X(e),l=T(e),u=es(e),d=P(e),f;d!==0?f=L(e,2+a):f=new Uint8Array(0);let h=new Uint8Array(19+f.byteLength),m=new DataView(h.buffer);m.setUint32(0,1332770163,!1),m.setUint32(4,1214603620,!1),m.setUint8(8,1),m.setUint8(9,a),m.setUint16(10,c,!0),m.setUint32(12,l,!0),m.setInt16(16,u,!0),m.setUint8(18,d),h.set(f,19),n.info.codecDescription=h,n.info.numberOfChannels=a}break;case\"dfLa\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"audio\"),e.skip(4);let a=127,c=128,l=e.filePos;for(;e.filePos<o;){let m=P(e),g=De(e);if((m&a)===dr.STREAMINFO){e.skip(10);let w=T(e),A=w>>>12,x=(w>>9&7)+1;n.info.sampleRate=A,n.info.numberOfChannels=x,e.skip(20)}else e.skip(g);if(m&c)break}let u=e.filePos;e.filePos=l;let d=L(e,u-l),f=new Uint8Array(4+d.byteLength);new DataView(f.buffer).setUint32(0,1716281667,!1),f.set(d,4),n.info.codecDescription=f}break;case\"dac3\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"audio\");let a=L(e,3),c=new D(a),l=c.readBits(2);c.skipBits(8);let u=c.readBits(3),d=c.readBits(1);l<3&&(n.info.sampleRate=Kt[l]),n.info.numberOfChannels=ci[u]+d}break;case\"dec3\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"audio\");let a=L(e,i.contentSize),c=_n(a);if(!c){R._warn(\"Invalid dec3 box contents, ignoring.\");break}let l=Cn(c);l!==null&&(n.info.sampleRate=l),n.info.numberOfChannels=En(c)}break;case\"ddts\":{let n=this.currentTrack;if(!n)break;p(n.info?.type===\"audio\");let a=L(e,Math.min(i.contentSize,gr)),c=Bn(a);if(!c){R._warn(\"Invalid ddts box contents, ignoring.\");break}n.info.sampleRate=c.sampleRate,c.numberOfChannels!==null&&(n.info.numberOfChannels=c.numberOfChannels)}break;case\"stts\":{let n=this.currentTrack;if(!n||!n.sampleTable)break;e.skip(4);let a=T(e),c=0,l=0;for(let u=0;u<a;u++){let d=T(e),f=T(e);n.sampleTable.sampleTimingEntries.push({startIndex:c,startDecodeTimestamp:l,count:d,delta:f}),c+=d,l+=d*f}}break;case\"ctts\":{let n=this.currentTrack;if(!n||!n.sampleTable)break;e.skip(4);let a=T(e),c=0;for(let l=0;l<a;l++){let u=T(e),d=Oe(e);n.sampleTable.sampleCompositionTimeOffsets.push({startIndex:c,count:u,offset:d}),c+=u}}break;case\"stsz\":{let n=this.currentTrack;if(!n||!n.sampleTable)break;e.skip(4);let a=T(e),c=T(e);if(a===0)for(let l=0;l<c;l++){let u=T(e);n.sampleTable.sampleSizes.push(u)}else n.sampleTable.sampleSizes.push(a)}break;case\"stz2\":{let n=this.currentTrack;if(!n||!n.sampleTable)break;e.skip(4),e.skip(3);let a=P(e),c=T(e),l=L(e,Math.ceil(c*a/8)),u=new D(l);for(let d=0;d<c;d++){let f=u.readBits(a);n.sampleTable.sampleSizes.push(f)}}break;case\"stss\":{let n=this.currentTrack;if(!n||!n.sampleTable)break;e.skip(4),n.sampleTable.keySampleIndices=[];let a=T(e);for(let c=0;c<a;c++){let l=T(e)-1;n.sampleTable.keySampleIndices.push(l)}n.sampleTable.keySampleIndices[0]!==0&&n.sampleTable.keySampleIndices.unshift(0)}break;case\"stsc\":{let n=this.currentTrack;if(!n||!n.sampleTable)break;e.skip(4);let a=T(e);for(let l=0;l<a;l++){let u=T(e)-1,d=T(e),f=T(e);n.sampleTable.sampleToChunk.push({startSampleIndex:-1,startChunkIndex:u,samplesPerChunk:d,sampleDescriptionIndex:f})}let c=0;for(let l=0;l<n.sampleTable.sampleToChunk.length;l++)if(n.sampleTable.sampleToChunk[l].startSampleIndex=c,l<n.sampleTable.sampleToChunk.length-1){let d=n.sampleTable.sampleToChunk[l+1].startChunkIndex-n.sampleTable.sampleToChunk[l].startChunkIndex;c+=d*n.sampleTable.sampleToChunk[l].samplesPerChunk}}break;case\"stco\":{let n=this.currentTrack;if(!n||!n.sampleTable)break;e.skip(4);let a=T(e);for(let c=0;c<a;c++){let l=T(e);n.sampleTable.chunkOffsets.push(l)}}break;case\"co64\":{let n=this.currentTrack;if(!n||!n.sampleTable)break;e.skip(4);let a=T(e);for(let c=0;c<a;c++){let l=te(e);n.sampleTable.chunkOffsets.push(l)}}break;case\"mvex\":this.isFragmented=!0,this.readContiguousBoxes(e.slice(s,i.contentSize));break;case\"mehd\":{let n=P(e);e.skip(3);let a=n===1?te(e):T(e);this.movieDurationInTimescale=a}break;case\"trex\":{e.skip(4);let n=T(e),a=T(e),c=T(e),l=T(e),u=T(e);this.fragmentTrackDefaults.push({trackId:n,defaultSampleDescriptionIndex:a,defaultSampleDuration:c,defaultSampleSize:l,defaultSampleFlags:u})}break;case\"tfra\":{let n=P(e);e.skip(3);let a=T(e),c=this.tracks.find(A=>A.id===a);if(!c)break;let l=T(e),u=(l&48)>>4,d=(l&12)>>2,f=l&3,h=[P,X,De,T],m=h[u],g=h[d],y=h[f],w=T(e);for(let A=0;A<w;A++){let x=n===1?te(e):T(e),v=n===1?te(e):T(e);m(e),g(e),y(e),c.fragmentLookupTable.push({timestamp:x,moofOffset:v})}c.fragmentLookupTable.sort((A,x)=>A.timestamp-x.timestamp);for(let A=0;A<c.fragmentLookupTable.length-1;A++){let x=c.fragmentLookupTable[A],v=c.fragmentLookupTable[A+1];x.timestamp===v.timestamp&&(c.fragmentLookupTable.splice(A+1,1),A--)}}break;case\"moof\":this.currentFragment={moofOffset:r,moofSize:i.totalSize,implicitBaseDataOffset:r,trackData:new Map,psshBoxes:[]},this.readContiguousBoxes(e.slice(s,i.contentSize)),this.lastReadFragment=this.currentFragment,this.currentFragment=null;break;case\"traf\":if(p(this.currentFragment),this.readContiguousBoxes(e.slice(s,i.contentSize)),this.currentTrack){let n=this.currentFragment.trackData.get(this.currentTrack.id);e:if(n){if(n.samples.length===0){this.currentFragment.trackData.delete(this.currentTrack.id);break e}n.presentationTimestamps=n.samples.map((u,d)=>({presentationTimestamp:u.presentationTimestamp,sampleIndex:d})).sort((u,d)=>u.presentationTimestamp-d.presentationTimestamp);for(let u=0;u<n.presentationTimestamps.length;u++){let d=n.presentationTimestamps[u],f=n.samples[d.sampleIndex];if(n.firstKeyFrameTimestamp===null&&f.isKeyFrame&&(n.firstKeyFrameTimestamp=f.presentationTimestamp),u<n.presentationTimestamps.length-1){let m=n.presentationTimestamps[u+1].presentationTimestamp-d.presentationTimestamp;f.duration=m}}let a=n.samples[n.presentationTimestamps[0].sampleIndex],c=n.samples[Z(n.presentationTimestamps).sampleIndex];n.startTimestamp=a.presentationTimestamp,n.endTimestamp=c.presentationTimestamp+c.duration;let{currentFragmentState:l}=this.currentTrack;p(l),l.startTimestamp!==null&&(di(n,l.startTimestamp),n.startTimestampIsFinal=!0),l.encryptionAuxInfo&&!n.samples[0].encryption&&(n.encryptionAuxInfo=l.encryptionAuxInfo)}this.currentTrack.currentFragmentState=null,this.currentTrack=null}break;case\"pssh\":{if(this.input._formatOptions.isobmff?._suppressPsshParsing)break;let n=Nn(L(e,i.contentSize));this.currentFragment?this.currentFragment.psshBoxes.push(n):this.currentTrack||this.psshBoxes.push(n)}break;case\"tfhd\":{p(this.currentFragment),e.skip(1);let n=De(e),a=!!(n&1),c=!!(n&2),l=!!(n&8),u=!!(n&16),d=!!(n&32),f=!!(n&65536),h=!!(n&131072),m=T(e),g=this.tracks.find(w=>w.id===m);if(!g)break;let y=this.fragmentTrackDefaults.find(w=>w.trackId===m);this.currentTrack=g,g.currentFragmentState={baseDataOffset:this.currentFragment.implicitBaseDataOffset,sampleDescriptionIndex:y?.defaultSampleDescriptionIndex??null,defaultSampleDuration:y?.defaultSampleDuration??null,defaultSampleSize:y?.defaultSampleSize??null,defaultSampleFlags:y?.defaultSampleFlags??null,startTimestamp:null,encryptionAuxInfo:null},a?g.currentFragmentState.baseDataOffset=te(e):h&&(g.currentFragmentState.baseDataOffset=this.currentFragment.moofOffset),c&&(g.currentFragmentState.sampleDescriptionIndex=T(e)),l&&(g.currentFragmentState.defaultSampleDuration=T(e)),u&&(g.currentFragmentState.defaultSampleSize=T(e)),d&&(g.currentFragmentState.defaultSampleFlags=T(e)),f&&(g.currentFragmentState.defaultSampleDuration=0)}break;case\"tfdt\":{let n=this.currentTrack;if(!n)break;p(n.currentFragmentState);let a=P(e);e.skip(3);let c=a===0?T(e):te(e);n.currentFragmentState.startTimestamp=c}break;case\"trun\":{let n=this.currentTrack;if(!n)break;p(this.currentFragment),p(n.currentFragmentState);let a=P(e),c=De(e),l=!!(c&1),u=!!(c&4),d=!!(c&256),f=!!(c&512),h=!!(c&1024),m=!!(c&2048),g=T(e),y=null;l&&(y=Oe(e));let w=null;u&&(w=T(e));let A;this.currentFragment.trackData.has(n.id)?(A=this.currentFragment.trackData.get(n.id),y!==null&&(A.currentOffset=n.currentFragmentState.baseDataOffset+y)):(A={track:n,currentTimestamp:0,currentOffset:n.currentFragmentState.baseDataOffset+(y??0),startTimestamp:0,endTimestamp:0,firstKeyFrameTimestamp:null,samples:[],presentationTimestamps:[],startTimestampIsFinal:!1,encryptionAuxInfo:null},this.currentFragment.trackData.set(n.id,A));for(let x=0;x<g;x++){let v;d?v=T(e):(p(n.currentFragmentState.defaultSampleDuration!==null),v=n.currentFragmentState.defaultSampleDuration);let U;f?U=T(e):(p(n.currentFragmentState.defaultSampleSize!==null),U=n.currentFragmentState.defaultSampleSize);let M;h?M=T(e):(p(n.currentFragmentState.defaultSampleFlags!==null),M=n.currentFragmentState.defaultSampleFlags),x===0&&w!==null&&(M=w);let _=0;m&&(a===0?_=T(e):_=Oe(e));let E=!(M&65536);A.samples.push({presentationTimestamp:A.currentTimestamp+_,duration:v,byteOffset:A.currentOffset,byteSize:U,isKeyFrame:E,encryption:null}),A.currentOffset+=U,A.currentTimestamp+=v}this.currentFragment.implicitBaseDataOffset=A.currentOffset}break;case\"saiz\":{let n=this.currentTrack;if(!n||!n.encryptionInfo)break;if(e.skip(1),De(e)&1){let f=se(e,4),h=T(e);if(f!==n.encryptionInfo.scheme||h!==0)break}let c=P(e),l=T(e),u=null;c===0&&l>0&&(u=L(e,l));let d=Gn(n);d.defaultSampleInfoSize=c,d.sampleSizes=u,d.sampleCount=l}break;case\"saio\":{let n=this.currentTrack;if(!n||!n.encryptionInfo)break;let a=P(e);if(De(e)&1){let f=se(e,4),h=T(e);if(f!==n.encryptionInfo.scheme||h!==0)break}let l=T(e);if(l===0)break;l>1&&R._warn(\"Multiple saio entries are not supported; using the first offset only.\");let u=a===0?T(e):Number(te(e));this.currentFragment&&(u+=this.currentFragment.moofOffset);let d=Gn(n);d.offset=u}break;case\"senc\":{let n=this.currentTrack;if(!n||!n.encryptionInfo)break;p(this.currentFragment);let a=this.currentFragment.trackData.get(n.id);if(!a)break;e.skip(1);let l=!!(De(e)&2),u=T(e),d=n.encryptionInfo.defaultPerSampleIvSize;p(d!==null);for(let f=0;f<Math.min(u,a.samples.length);f++){let h=new Uint8Array(16);d>0?h.set(L(e,d),0):h.set(n.encryptionInfo.defaultConstantIv,0);let m=null;if(l){let y=X(e);m=[];for(let w=0;w<y;w++){let A=X(e),x=T(e);m.push({clearLen:A,protectedLen:x})}}let g=a.samples[f];g.encryption={iv:h,subsamples:m}}}break;case\"udta\":{let n=this.iterateContiguousBoxes(e.slice(s,i.contentSize));for(let{boxInfo:a,slice:c}of n){if(a.name!==\"meta\"&&!this.currentTrack){let l=c.filePos;this.metadataTags.raw??={},a.name[0]===\"\\xA9\"?this.metadataTags.raw[a.name]??=be(c):this.metadataTags.raw[a.name]??=L(c,a.contentSize),c.filePos=l}switch(a.name){case\"meta\":c.skip(-a.headerSize),this.traverseBox(c);break;case\"\\xA9nam\":case\"name\":this.currentTrack?this.currentTrack.name=Ne.decode(L(c,a.contentSize)):this.metadataTags.title??=be(c);break;case\"\\xA9des\":this.currentTrack||(this.metadataTags.description??=be(c));break;case\"\\xA9ART\":this.currentTrack||(this.metadataTags.artist??=be(c));break;case\"\\xA9alb\":this.currentTrack||(this.metadataTags.album??=be(c));break;case\"albr\":this.currentTrack||(this.metadataTags.albumArtist??=be(c));break;case\"\\xA9gen\":this.currentTrack||(this.metadataTags.genre??=be(c));break;case\"\\xA9day\":if(!this.currentTrack){let l=new Date(be(c));Number.isNaN(l.getTime())||(this.metadataTags.date??=l)}break;case\"\\xA9cmt\":this.currentTrack||(this.metadataTags.comment??=be(c));break;case\"\\xA9lyr\":this.currentTrack||(this.metadataTags.lyrics??=be(c));break}}}break;case\"meta\":{if(this.currentTrack)break;let a=T(e)!==0;this.currentMetadataKeys=new Map,a?this.readContiguousBoxes(e.slice(s,i.contentSize)):this.readContiguousBoxes(e.slice(s+4,i.contentSize-4)),this.currentMetadataKeys=null}break;case\"keys\":{if(!this.currentMetadataKeys)break;e.skip(4);let n=T(e);for(let a=0;a<n;a++){let c=T(e);e.skip(4);let l=Ne.decode(L(e,c-8));this.currentMetadataKeys.set(a+1,l)}}break;case\"ilst\":{if(!this.currentMetadataKeys)break;let n=this.iterateContiguousBoxes(e.slice(s,i.contentSize));for(let{boxInfo:a,slice:c}of n){let l=a.name,u=(l.charCodeAt(0)<<24)+(l.charCodeAt(1)<<16)+(l.charCodeAt(2)<<8)+l.charCodeAt(3);this.currentMetadataKeys.has(u)&&(l=this.currentMetadataKeys.get(u));let d=Hn(c);switch(this.metadataTags.raw??={},this.metadataTags.raw[l]??=d,l){case\"\\xA9nam\":case\"titl\":case\"com.apple.quicktime.title\":case\"title\":typeof d==\"string\"&&(this.metadataTags.title??=d);break;case\"\\xA9des\":case\"desc\":case\"dscp\":case\"com.apple.quicktime.description\":case\"description\":typeof d==\"string\"&&(this.metadataTags.description??=d);break;case\"\\xA9ART\":case\"com.apple.quicktime.artist\":case\"artist\":typeof d==\"string\"&&(this.metadataTags.artist??=d);break;case\"\\xA9alb\":case\"albm\":case\"com.apple.quicktime.album\":case\"album\":typeof d==\"string\"&&(this.metadataTags.album??=d);break;case\"aART\":case\"album_artist\":typeof d==\"string\"&&(this.metadataTags.albumArtist??=d);break;case\"\\xA9cmt\":case\"com.apple.quicktime.comment\":case\"comment\":typeof d==\"string\"&&(this.metadataTags.comment??=d);break;case\"\\xA9gen\":case\"gnre\":case\"com.apple.quicktime.genre\":case\"genre\":typeof d==\"string\"&&(this.metadataTags.genre??=d);break;case\"\\xA9lyr\":case\"lyrics\":typeof d==\"string\"&&(this.metadataTags.lyrics??=d);break;case\"\\xA9day\":case\"rldt\":case\"com.apple.quicktime.creationdate\":case\"date\":if(typeof d==\"string\"){let f=new Date(d);Number.isNaN(f.getTime())||(this.metadataTags.date??=f)}break;case\"tmpo\":if(d instanceof Uint8Array&&d.length>=2){let f=H(d).getInt16(0,!1);f>0&&(this.metadataTags.beatsPerMinute??=f)}break;case\"covr\":case\"com.apple.quicktime.artwork\":d instanceof ye?(this.metadataTags.images??=[],this.metadataTags.images.push({data:d.data,kind:\"coverFront\",mimeType:d.mimeType})):d instanceof Uint8Array&&(this.metadataTags.images??=[],this.metadataTags.images.push({data:d,kind:\"coverFront\",mimeType:\"image/*\"}));break;case\"track\":if(typeof d==\"string\"){let f=d.split(\"/\"),h=Number.parseInt(f[0],10),m=f[1]&&Number.parseInt(f[1],10);Number.isInteger(h)&&h>0&&(this.metadataTags.trackNumber??=h),m&&Number.isInteger(m)&&m>0&&(this.metadataTags.tracksTotal??=m)}break;case\"trkn\":if(d instanceof Uint8Array&&d.length>=6){let f=H(d),h=f.getUint16(2,!1),m=f.getUint16(4,!1);h>0&&(this.metadataTags.trackNumber??=h),m>0&&(this.metadataTags.tracksTotal??=m)}break;case\"disc\":case\"disk\":if(d instanceof Uint8Array&&d.length>=6){let f=H(d),h=f.getUint16(2,!1),m=f.getUint16(4,!1);h>0&&(this.metadataTags.discNumber??=h),m>0&&(this.metadataTags.discsTotal??=m)}break}}}break}return e.filePos=o,!0}},Cr=class{constructor(e){this.internalTrack=e,this.packetToSampleIndex=new WeakMap,this.packetToFragmentLocation=new WeakMap}getId(){return this.internalTrack.id}getNumber(){let e=this.internalTrack.demuxer,r=this.internalTrack.trackBacking.getType(),i=0;for(let s of e.tracks)if(s.trackBacking.getType()===r&&i++,s===this.internalTrack)break;return i}getCodec(){throw new Error(\"Not implemented on base class.\")}getInternalCodecId(){return this.internalTrack.internalCodecId}getName(){return this.internalTrack.name}getLanguageCode(){return this.internalTrack.languageCode}getTimeResolution(){return this.internalTrack.timescale}isRelativeToUnixEpoch(){return!1}getUnixTimeForTimestamp(){return null}getDisposition(){return this.internalTrack.disposition}getPairingMask(){return 1n}getBitrate(){return this.internalTrack.maxBitrate}getAverageBitrate(){return this.internalTrack.avgBitrate}async getDurationFromMetadata(){let e=this.internalTrack;return e.durationInMediaTimescale<=0?null:(p(e.trackBacking),((await e.trackBacking.getFirstPacket({metadataOnly:!0}))?.timestamp??0)+e.durationInMediaTimescale/e.timescale)}async getLiveRefreshInterval(){return null}async getFirstPacket(e){let r=await this.fetchPacketForSampleIndex(0,e);return r||!this.internalTrack.demuxer.isFragmented?r:this.performFragmentedLookup(null,i=>i.trackData.get(this.internalTrack.id)?{sampleIndex:0,correctSampleFound:!0}:{sampleIndex:-1,correctSampleFound:!1},-1/0,1/0,e)}mapTimestampIntoTimescale(e){return Hi(e*this.internalTrack.timescale)+this.internalTrack.editListOffset}async getPacket(e,r){let i=this.mapTimestampIntoTimescale(e),s=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),o=fi(s,i),n=await this.fetchPacketForSampleIndex(o,r);return!$n(s)||!this.internalTrack.demuxer.isFragmented?n:this.performFragmentedLookup(null,a=>{let c=a.trackData.get(this.internalTrack.id);if(!c)return{sampleIndex:-1,correctSampleFound:!1};let l=Y(c.presentationTimestamps,i,f=>f.presentationTimestamp),u=l!==-1?c.presentationTimestamps[l].sampleIndex:-1,d=l!==-1&&i<c.endTimestamp;return{sampleIndex:u,correctSampleFound:d}},i,i,r)}async getNextPacket(e,r){let i=this.packetToSampleIndex.get(e);if(i!==void 0)return this.fetchPacketForSampleIndex(i+1,r);let s=this.packetToFragmentLocation.get(e);if(s===void 0)throw new Error(\"Packet was not created from this track.\");return this.performFragmentedLookup(s.fragment,o=>{if(o===s.fragment){let n=o.trackData.get(this.internalTrack.id);if(s.sampleIndex+1<n.samples.length)return{sampleIndex:s.sampleIndex+1,correctSampleFound:!0}}else if(o.trackData.get(this.internalTrack.id))return{sampleIndex:0,correctSampleFound:!0};return{sampleIndex:-1,correctSampleFound:!1}},-1/0,1/0,r)}async getKeyPacket(e,r){let i=this.mapTimestampIntoTimescale(e),s=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),o=xo(s,i),n=await this.fetchPacketForSampleIndex(o,r);return!$n(s)||!this.internalTrack.demuxer.isFragmented?n:this.performFragmentedLookup(null,a=>{let c=a.trackData.get(this.internalTrack.id);if(!c)return{sampleIndex:-1,correctSampleFound:!1};let l=Ni(c.presentationTimestamps,f=>c.samples[f.sampleIndex].isKeyFrame&&f.presentationTimestamp<=i),u=l!==-1?c.presentationTimestamps[l].sampleIndex:-1,d=l!==-1&&i<c.endTimestamp;return{sampleIndex:u,correctSampleFound:d}},i,i,r)}async getNextKeyPacket(e,r){let i=this.packetToSampleIndex.get(e);if(i!==void 0){let o=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),n=So(o,i);return this.fetchPacketForSampleIndex(n,r)}let s=this.packetToFragmentLocation.get(e);if(s===void 0)throw new Error(\"Packet was not created from this track.\");return this.performFragmentedLookup(s.fragment,o=>{if(o===s.fragment){let a=o.trackData.get(this.internalTrack.id).samples.findIndex((c,l)=>c.isKeyFrame&&l>s.sampleIndex);if(a!==-1)return{sampleIndex:a,correctSampleFound:!0}}else{let n=o.trackData.get(this.internalTrack.id);if(n&&n.firstKeyFrameTimestamp!==null){let a=n.samples.findIndex(c=>c.isKeyFrame);return p(a!==-1),{sampleIndex:a,correctSampleFound:!0}}}return{sampleIndex:-1,correctSampleFound:!1}},-1/0,1/0,r)}async fetchPacketForSampleIndex(e,r){if(e===-1)return null;let i=this.internalTrack.demuxer.getSampleTableForTrack(this.internalTrack),s=To(i,e);if(!s)return null;let o;if(r.metadataOnly)o=Gt;else{let l=this.internalTrack.demuxer.reader.requestSlice(s.sampleOffset,s.sampleSize);if(F(l)&&(l=await l),!l)return null;if(o=L(l,s.sampleSize),this.internalTrack.encryptionInfo){let u=null;if(this.internalTrack.encryptionAuxInfo){let d=await Yn(this.internalTrack.demuxer.reader,this.internalTrack.encryptionInfo,this.internalTrack.encryptionAuxInfo);e<d.length&&(u=d[e])}u??=Xn(this.internalTrack.encryptionInfo),u&&(o=await Zn(this.internalTrack,u,o,null))}}let n=(s.presentationTimestamp-this.internalTrack.editListOffset)/this.internalTrack.timescale,a=s.duration/this.internalTrack.timescale,c=new G(o,s.isKeyFrame?\"key\":\"delta\",n,a,e,s.sampleSize);return this.packetToSampleIndex.set(c,e),c}async fetchPacketInFragment(e,r,i){if(r===-1)return null;let o=e.trackData.get(this.internalTrack.id).samples[r];p(o);let n;if(i.metadataOnly)n=Gt;else{let u=this.internalTrack.demuxer.reader.requestSlice(o.byteOffset,o.byteSize);if(F(u)&&(u=await u),!u)return null;if(n=L(u,o.byteSize),this.internalTrack.encryptionInfo){let d=o.encryption??Xn(this.internalTrack.encryptionInfo);d&&(n=await Zn(this.internalTrack,d,n,e))}}let a=(o.presentationTimestamp-this.internalTrack.editListOffset)/this.internalTrack.timescale,c=o.duration/this.internalTrack.timescale,l=new G(n,o.isKeyFrame?\"key\":\"delta\",a,c,e.moofOffset+r,o.byteSize);return this.packetToFragmentLocation.set(l,{fragment:e,sampleIndex:r}),l}async performFragmentedLookup(e,r,i,s,o){let n=this.internalTrack.demuxer,a=null,c=null,l=-1;if(e){let{sampleIndex:y,correctSampleFound:w}=r(e);if(w)return this.fetchPacketInFragment(e,y,o);y!==-1&&(c=e,l=y)}let u=Y(this.internalTrack.fragmentLookupTable,i,y=>y.timestamp),d=u!==-1?this.internalTrack.fragmentLookupTable[u]:null,f=Y(this.internalTrack.fragmentPositionCache,i,y=>y.startTimestamp),h=f!==-1?this.internalTrack.fragmentPositionCache[f]:null,m=Math.max(d?.moofOffset??0,h?.moofOffset??0)||null,g;for(e?m===null||e.moofOffset>=m?(g=e.moofOffset+e.moofSize,a=e):g=m:g=m??0;;){if(a){let x=a.trackData.get(this.internalTrack.id);if(x&&x.startTimestamp>s)break}let y=n.reader.requestSliceRange(g,Ae,Fe);if(F(y)&&(y=await y),!y)break;let w=g,A=Me(y);if(!A)break;if(A.name===\"moof\"){a=await n.readFragment(w);let{sampleIndex:x,correctSampleFound:v}=r(a);if(v)return this.fetchPacketInFragment(a,x,o);x!==-1&&(c=a,l=x)}g=w+A.totalSize}if(d&&(!c||c.moofOffset<d.moofOffset)){let y=this.internalTrack.fragmentLookupTable[u-1];p(!y||y.timestamp<d.timestamp);let w=y?.timestamp??-1/0;return this.performFragmentedLookup(null,r,w,s,o)}return c?this.fetchPacketInFragment(c,l,o):null}},Er=class extends Cr{constructor(e){super(e),this.decoderConfigPromise=null}getType(){return\"video\"}getCodec(){return this.internalTrack.info.codec}getCodedWidth(){return this.internalTrack.info.width}getCodedHeight(){return this.internalTrack.info.height}getSquarePixelWidth(){return this.internalTrack.info.squarePixelWidth}getSquarePixelHeight(){return this.internalTrack.info.squarePixelHeight}getTransformationMatrix(){return[...this.internalTrack.matrix]}async getColorSpace(){let e=await this.getDecoderConfig();return e?{primaries:e.colorSpace?.primaries,transfer:e.colorSpace?.transfer,matrix:e.colorSpace?.matrix,fullRange:e.colorSpace?.fullRange}:this.internalTrack.info.colorSpace}async canBeTransparent(){return this.internalTrack.info.codec===\"prores\"&&(this.internalTrack.info.proresFormat===\"ap4h\"||this.internalTrack.info.proresFormat===\"ap4x\")}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??=(async()=>{if(this.internalTrack.info.codec===\"avc\"&&!this.internalTrack.info.codecDescription){let r=await this.getFirstPacket({});this.internalTrack.info.avcCodecInfo=r&&mr(r.data)}else if(this.internalTrack.info.codec===\"hevc\"&&!this.internalTrack.info.codecDescription){let r=await this.getFirstPacket({});this.internalTrack.info.hevcCodecInfo=r&&pr(r.data)}else if(this.internalTrack.info.codec===\"vp9\"&&(!this.internalTrack.info.vp9CodecInfo||!yn(this.internalTrack.info.vp9CodecInfo))){let r=await this.getFirstPacket({}),i=r&&gn(r.data);i&&(this.internalTrack.info.vp9CodecInfo={...this.internalTrack.info.vp9CodecInfo??i,videoFullRangeFlag:i.videoFullRangeFlag,colourPrimaries:i.colourPrimaries,transferCharacteristics:i.transferCharacteristics,matrixCoefficients:i.matrixCoefficients})}else if(this.internalTrack.info.codec===\"av1\"&&(!this.internalTrack.info.av1CodecInfo||!An(this.internalTrack.info.av1CodecInfo))){let r=await this.getFirstPacket({}),i=r&&ai(r.data);i&&(this.internalTrack.info.av1CodecInfo=i)}else if(this.internalTrack.info.codec===\"prores\"&&!this.internalTrack.info.proresCodecInfo){let r=await this.getFirstPacket({});this.internalTrack.info.proresCodecInfo=r&&bn(r.data)}if(!Qr(this.internalTrack.info.colorSpace)){let r=zn(this.internalTrack.info);this.internalTrack.info.colorSpace.primaries??=r.primaries,this.internalTrack.info.colorSpace.transfer??=r.transfer,this.internalTrack.info.colorSpace.matrix??=r.matrix,this.internalTrack.info.colorSpace.fullRange??=r.fullRange}let e={codec:On(this.internalTrack.info),codedWidth:this.internalTrack.info.width,codedHeight:this.internalTrack.info.height,description:this.internalTrack.info.codecDescription??void 0,colorSpace:this.internalTrack.info.colorSpace};return(this.internalTrack.info.width!==this.internalTrack.info.squarePixelWidth||this.internalTrack.info.height!==this.internalTrack.info.squarePixelHeight)&&(e.displayAspectWidth=this.internalTrack.info.squarePixelWidth,e.displayAspectHeight=this.internalTrack.info.squarePixelHeight),e})():null}},Ir=class extends Cr{constructor(e){super(e),this.decoderConfigPromise=null}getType(){return\"audio\"}getCodec(){return this.internalTrack.info.codec}getNumberOfChannels(){return this.internalTrack.info.numberOfChannels}getSampleRate(){return this.internalTrack.info.sampleRate}async getDecoderConfig(){return this.internalTrack.info.codec?this.decoderConfigPromise??=(async()=>{if(this.internalTrack.info.codec===\"dts\"&&!this.internalTrack.info.dtsFormat){let e=await this.getFirstPacket({});this.internalTrack.info.dtsFormat=e&&vn(e.data)}return{codec:Dn(this.internalTrack.info),numberOfChannels:this.internalTrack.info.numberOfChannels,sampleRate:this.internalTrack.info.sampleRate,description:this.internalTrack.info.codecDescription??void 0}})():null}},fi=(t,e)=>{if(t.presentationTimestamps){let r=Y(t.presentationTimestamps,e,i=>i.presentationTimestamp);return r===-1?-1:t.presentationTimestamps[r].sampleIndex}else{let r=Y(t.sampleTimingEntries,e,s=>s.startDecodeTimestamp);if(r===-1)return-1;let i=t.sampleTimingEntries[r];return i.startIndex+Math.min(Math.floor((e-i.startDecodeTimestamp)/i.delta),i.count-1)}},xo=(t,e)=>{if(!t.keySampleIndices)return fi(t,e);if(t.presentationTimestamps){let r=Y(t.presentationTimestamps,e,i=>i.presentationTimestamp);if(r===-1)return-1;for(let i=r;i>=0;i--){let s=t.presentationTimestamps[i].sampleIndex;if($r(t.keySampleIndices,s,n=>n)!==-1)return s}return-1}else{let r=fi(t,e),i=Y(t.keySampleIndices,r,s=>s);return t.keySampleIndices[i]??-1}},To=(t,e)=>{let r=Y(t.sampleTimingEntries,e,w=>w.startIndex),i=t.sampleTimingEntries[r];if(!i||i.startIndex+i.count<=e)return null;let o=i.startDecodeTimestamp+(e-i.startIndex)*i.delta,n=Y(t.sampleCompositionTimeOffsets,e,w=>w.startIndex),a=t.sampleCompositionTimeOffsets[n];a&&e-a.startIndex<a.count&&(o+=a.offset);let c=t.sampleSizes[Math.min(e,t.sampleSizes.length-1)],l=Y(t.sampleToChunk,e,w=>w.startSampleIndex),u=t.sampleToChunk[l];p(u);let d=u.startChunkIndex+Math.floor((e-u.startSampleIndex)/u.samplesPerChunk),f=t.chunkOffsets[d],h=u.startSampleIndex+(d-u.startChunkIndex)*u.samplesPerChunk,m=0,g=f;if(t.sampleSizes.length===1)g+=c*(e-h),m+=c*u.samplesPerChunk;else for(let w=h;w<h+u.samplesPerChunk;w++){let A=t.sampleSizes[w];w<e&&(g+=A),m+=A}let y=i.delta;if(t.presentationTimestamps){let w=t.presentationTimestampIndexMap[e];p(w!==void 0),w<t.presentationTimestamps.length-1&&(y=t.presentationTimestamps[w+1].presentationTimestamp-o)}return{presentationTimestamp:o,duration:y,sampleOffset:g,sampleSize:c,chunkOffset:f,chunkSize:m,isKeyFrame:t.keySampleIndices?$r(t.keySampleIndices,e,w=>w)!==-1:!0}},So=(t,e)=>{if(!t.keySampleIndices)return e+1;let r=Y(t.keySampleIndices,e,i=>i);return t.keySampleIndices[r+1]??-1},di=(t,e)=>{t.startTimestamp+=e,t.endTimestamp+=e;for(let r of t.samples)r.presentationTimestamp+=e;for(let r of t.presentationTimestamps)r.presentationTimestamp+=e},Kn=t=>[Ge(t),Ge(t),Tr(t),Ge(t),Ge(t),Tr(t),Ge(t),Ge(t),Tr(t)],$n=t=>t.sampleSizes.length===0,Gn=t=>t.currentFragmentState?t.currentFragmentState.encryptionAuxInfo??={defaultSampleInfoSize:0,sampleSizes:null,sampleCount:0,offset:null,resolved:null}:t.encryptionAuxInfo??={defaultSampleInfoSize:0,sampleSizes:null,sampleCount:0,offset:null,resolved:null},Yn=async(t,e,r)=>{if(r.resolved)return r.resolved;if(r.offset===null||r.sampleCount===0)throw new Error(\"Incomplete saiz/saio info; cannot resolve encryption data.\");let i=0;if(r.defaultSampleInfoSize>0)i=r.defaultSampleInfoSize*r.sampleCount;else{p(r.sampleSizes);for(let a=0;a<r.sampleCount;a++)i+=r.sampleSizes[a]}let s=t.requestSlice(r.offset,i);if(F(s)&&(s=await s),!s)throw new Error(\"Failed to read auxiliary encryption info.\");let o=e.defaultPerSampleIvSize;p(o!==null);let n=[];for(let a=0;a<r.sampleCount;a++){let c=r.defaultSampleInfoSize>0?r.defaultSampleInfoSize:r.sampleSizes[a],l=new Uint8Array(16);o>0?l.set(L(s,o),0):l.set(e.defaultConstantIv,0);let u=null;if(c>o){let d=X(s);u=[];for(let f=0;f<d;f++){let h=X(s),m=T(s);u.push({clearLen:h,protectedLen:m})}}n.push({iv:l,subsamples:u})}return r.resolved=n,n},Xn=t=>t.defaultConstantIv?{iv:t.defaultConstantIv,subsamples:null}:null,Zn=async(t,e,r,i)=>{p(t.encryptionInfo);let s=t.encryptionInfo;p(s.defaultKid!==null);let o=s.defaultKid,n,a=t.demuxer.decryptionKeyCache.get(o);if(a)n=await a;else{if(!t.demuxer.input._formatOptions.isobmff?.resolveKeyId)throw new Error(\"Encrypted media samples encountered. To decrypt them, please provide a callback for InputOptions.formatOptions.isobmff.resolveKeyId.\");let c=(async()=>{let l=t.demuxer.psshBoxes;if(i){l=[...l,...i.psshBoxes].filter(d=>d.keyIds===null||d.keyIds.includes(o));for(let d=0;d<l.length-1;d++)for(let f=d+1;f<l.length;f++)qn(l[d],l[f])&&(l.splice(f,1),f--)}let u=await t.demuxer.input._formatOptions.isobmff.resolveKeyId({keyId:o,psshBoxes:l});if(!(typeof u==\"string\"&&u.length===32&&Vi.test(u)||u instanceof Uint8Array&&u.byteLength===16))throw new TypeError(\"resolveKeyId must return a 32-character hex string or a 16-byte Uint8Array containing the decryption key.\");return u instanceof Uint8Array?u:Wi(u)})();t.demuxer.decryptionKeyCache.set(o,c),n=await c}return s.scheme===\"cenc\"||s.scheme===\"cens\"?ko(n,s,e,r):_o(n,s,e,r)},ko=async(t,e,r,i)=>{let s=new Uint8Array(16);s.set(r.iv,0);let o=await crypto.subtle.importKey(\"raw\",t,{name:\"AES-CTR\"},!1,[\"decrypt\"]),n=async m=>{let g=await crypto.subtle.decrypt({name:\"AES-CTR\",counter:s,length:64},o,m);return new Uint8Array(g)};if(!r.subsamples)return n(i);p(e.defaultCryptByteBlock!==null&&e.defaultSkipByteBlock!==null);let a=Jn(r.subsamples,e.defaultCryptByteBlock,e.defaultSkipByteBlock),c=0;for(let m of a)for(let g of m.perSubsample)c+=g.length;let l=new Uint8Array(c),u=0;for(let m of a)for(let g of m.perSubsample)l.set(i.subarray(g.offset,g.offset+g.length),u),u+=g.length;let d=await n(l),f=new Uint8Array(i),h=0;for(let m of a)for(let g of m.perSubsample)f.set(d.subarray(h,h+g.length),g.offset),h+=g.length;return f},_o=(t,e,r,i)=>{let s=new kr;s.init({key:t,iv:r.iv});let o=e.defaultCryptByteBlock,n=e.defaultSkipByteBlock;if(p(o!==null&&n!==null),!r.subsamples){let u=new Uint8Array(i),d=Math.floor(i.length/16);for(let f=0;f<d;f++){let h=f*16;s.in.set(i.subarray(h,h+16)),s.decrypt(),u.set(s.out,h)}return u}if(o===0&&n===0)throw new Error(\"cbcs with subsamples requires pattern encryption.\");let a=new Uint8Array(i),c=Jn(r.subsamples,o,n),l=new DataView(r.iv.buffer,r.iv.byteOffset,16);for(let u of c){s.iv[0]=l.getUint32(0,!1),s.iv[1]=l.getUint32(4,!1),s.iv[2]=l.getUint32(8,!1),s.iv[3]=l.getUint32(12,!1);for(let d of u.perSubsample){let f=d.length/16;for(let h=0;h<f;h++){let m=d.offset+h*16;s.in.set(i.subarray(m,m+16)),s.decrypt(),a.set(s.out,m)}}}return a},Jn=(t,e,r)=>{let i=[],s=e!==0||r!==0,o=0;for(let n of t){o+=n.clearLen;let a=[];if(!s)n.protectedLen>0&&a.push({offset:o,length:n.protectedLen}),o+=n.protectedLen;else{let c=n.protectedLen,l=o;for(;c>0&&!(c<16*e);){let u=16*e;a.push({offset:l,length:u}),l+=u,c-=u;let d=Math.min(16*r,c);l+=d,c-=d}o+=n.protectedLen}i.push({perSubsample:a})}return i};var is=7,ns=9,hi=t=>{let e=t.filePos,r=L(t,9),i=new D(r);if(i.readBits(12)!==4095||(i.skipBits(1),i.readBits(2)!==0))return null;let n=i.readBits(1),a=i.readBits(2)+1,c=i.readBits(4);if(c===15)return null;i.skipBits(1);let l=i.readBits(3);if(l===0)throw new Error(\"ADTS frames with channel configuration 0 are not supported.\");i.skipBits(1),i.skipBits(1),i.skipBits(1),i.skipBits(1);let u=i.readBits(13);i.skipBits(11);let d=i.readBits(2)+1;if(d!==1)throw new Error(\"ADTS frames with more than one AAC frame are not supported.\");let f=null;return n===1?t.filePos-=2:f=i.readBits(16),{objectType:a,samplingFrequencyIndex:c,channelConfiguration:l,frameLength:u,numberOfAacFrames:d,crcCheck:f,startPos:e}};ar();var mi=0,pi=1/0,Co=null;typeof FinalizationRegistry<\"u\"&&(Co=new FinalizationRegistry(t=>{t()}));var he=class extends de{constructor(){super(),this._disposed=!1,this._refCount=0,this._usedForHls=!1,this._refFinalizationRegistry=null,this._sizePromise=null,this.onread=null,typeof FinalizationRegistry<\"u\"&&(this._refFinalizationRegistry=new FinalizationRegistry(e=>{e._decrementRefCount()}))}async getSizeOrNull(){if(this._disposed)throw new ee;return this._sizePromise??=(async()=>{let e=this._getFileSize();return e!==void 0||(await this._read(0,1,mi,pi),e=this._getFileSize(),p(e!==void 0)),e})()}async getSize(){if(this._disposed)throw new ee;let e=await this.getSizeOrNull();if(e===null)throw new Error(\"Cannot determine the size of an unsized source.\");return e}slice(e,r){if(!Number.isInteger(e)||e<0)throw new TypeError(\"offset must be a non-negative integer.\");if(r!==void 0&&(!Number.isInteger(r)||r<0))throw new TypeError(\"length, when provided, must be a non-negative integer.\");return new vr(this,e,r)}_dispatchRead(e,r){this.onread?.(e,r),this._emit(\"read\",{start:e,end:r})}ref(){return new at(this)}_incrementRefCount(){this._refCount++}_decrementRefCount(){this._refCount--,this._refCount===0&&(this._dispose(),this._disposed=!0)}},at=class{constructor(e){if(this._freed=!1,e._disposed)throw new Error(\"Cannot ref a disposed source.\");e._incrementRefCount(),e._refFinalizationRegistry?.register(this,e,this),this._source=e}get source(){if(!this._source)throw new Error(\"Can't get source; ref has already been freed.\");return this._source}get freed(){return this._freed}free(){if(this._freed)throw new Error(\"Illegal operation: double free on SourceRef.\");let e=this.source;p(e._refCount>0),e._decrementRefCount(),e._refFinalizationRegistry?.unregister(this),this._freed=!0,this._source=null}[Symbol.dispose](){this.freed||this.free()}},Xt=class extends he{constructor(e,r){if(typeof e!=\"string\")throw new TypeError(\"rootPath must be a string.\");if(typeof r!=\"function\")throw new TypeError(\"requestHandler must be a function.\");super(),this.rootPath=e,this.requestHandler=r}_resolveRequest(e){let r=this.requestHandler(e),i=s=>{if(!(s instanceof he||s instanceof at))throw new TypeError(\"requestHandler must return or resolve to a Source or SourceRef.\");let o=s instanceof he?s.ref():s;return o.source._usedForHls||=this._usedForHls,o};return F(r)?r.then(i):i(r)}},gi=(t,e)=>t.path===e.path;var kt=class extends he{constructor(e){if(!(e instanceof ArrayBuffer)&&!(typeof SharedArrayBuffer<\"u\"&&e instanceof SharedArrayBuffer)&&!ArrayBuffer.isView(e))throw new TypeError(\"buffer must be an ArrayBuffer, SharedArrayBuffer, or ArrayBufferView.\");super(),this._onreadCalled=!1,this._bytes=ae(e),this._view=H(e)}_getFileSize(){return this._bytes.byteLength}_read(){return this._onreadCalled||(this._dispatchRead(0,this._bytes.byteLength),this._onreadCalled=!0),{bytes:this._bytes,view:this._view,offset:0}}_dispose(){}},$c=typeof FinalizationRegistry<\"u\"?new FinalizationRegistry(t=>{t.cancel().catch(()=>{})}):null;var Gc=.5*2**20;var vr=class extends he{constructor(e,r,i){if(super(),this._ref=null,e._disposed)throw new Error(\"Cannot create a slice of a disposed source.\");this._baseSource=e,this._offset=r,this._length=i??null}_getFileSize(){let e=this._baseSource._getFileSize();return e===void 0?this._length!==null?this._length:void 0:e===null?this._length!==null?this._length:null:gt(e-this._offset,0,this._length??1/0)}_read(e,r,i,s){if(this._length!==null&&r>this._length)return null;let o=this._baseSource._read(this._offset+e,this._offset+r,this._offset+i,this._offset+s),n=a=>a?(a.offset-=this._offset,a):null;return F(o)?o.then(n):n(o)}_dispose(){this._ref?.free()}ref(){return this._ref??=this._baseSource.ref(),super.ref()}};var _t=class{constructor(){this._isIsobmff=!1}},Br=class extends _t{constructor(){super(...arguments),this._isIsobmff=!0}async _getMajorBrand(e){let r=e._reader.requestSlice(0,12);if(F(r)&&(r=await r),!r)return null;r.skip(4);let i=se(r,4);return i!==\"ftyp\"&&i!==\"styp\"?null:se(r,4)}_createDemuxer(e){return new _r(e)}},Pr=class extends Br{async _canReadInput(e){let r=await this._getMajorBrand(e);if(r!==null)return r!==\"qt  \";let i=0;for(let s=0;s<10;s++){let o=e._reader.requestSlice(i,8);if(F(o)&&(o=await o),!o)return!1;let n=T(o),a=8;if(n===1){let l=e._reader.requestSlice(i+8,8);if(F(l)&&(l=await l),!l)return!1;n=te(l),a=16}if(n<a)return!1;let c=se(o,4);if(c===\"moof\"||c===\"sidx\")return!0;if(c===\"emsg\"||c===\"prft\"||c===\"free\")i+=n;else return!1}return!1}get name(){return\"MP4\"}get mimeType(){return\"video/mp4\"}};var Rr=new Pr;var os=(t,e)=>{if(!t||typeof t!=\"object\")throw new TypeError(`${e}, when provided, must be an object.`);if(t.isobmff!==void 0){if(!t.isobmff||typeof t.isobmff!=\"object\")throw new TypeError(`${e}.isobmff, when provided, must be an object.`);if(t.isobmff.resolveKeyId!==void 0&&typeof t.isobmff.resolveKeyId!=\"function\")throw new TypeError(`${e}.isobmff.resolveKeyId, when provided, must be a function.`)}if(t.hls!==void 0){if(!t.hls||typeof t.hls!=\"object\")throw new TypeError(`${e}.hls, when provided, must be an object.`);if(t.hls.offsetTimestampsByDateTime!==void 0&&typeof t.hls.offsetTimestampsByDateTime!=\"boolean\")throw new TypeError(`${e}.hls.offsetTimestampsByDateTime, when provided, must be a boolean.`)}};var as=[],cs=[];var ct=t=>{if(!t||typeof t!=\"object\")throw new TypeError(\"options must be an object.\");if(t.metadataOnly!==void 0&&typeof t.metadataOnly!=\"boolean\")throw new TypeError(\"options.metadataOnly, when defined, must be a boolean.\");if(t.verifyKeyPackets!==void 0&&typeof t.verifyKeyPackets!=\"boolean\")throw new TypeError(\"options.verifyKeyPackets, when defined, must be a boolean.\");if(t.verifyKeyPackets&&t.metadataOnly)throw new TypeError(\"options.verifyKeyPackets and options.metadataOnly cannot be enabled together.\");if(t.skipLiveWait!==void 0&&typeof t.skipLiveWait!=\"boolean\")throw new TypeError(\"options.skipLiveWait, when defined, must be a boolean.\")},ls=t=>{if(!it(t))throw new TypeError(\"timestamp must be a number.\")},yi=(t,e,r)=>r.verifyKeyPackets?e.then(async i=>{if(!i||i.type===\"delta\")return i;let s=await t.determinePacketType(i);return s&&(i.type=s),i}):e,Xe=class{constructor(e){if(!(e instanceof Ct))throw new TypeError(\"track must be an InputTrack.\");this._track=e}async getFirstPacket(e={}){if(ct(e),this._track.input._disposed)throw new ee;return yi(this._track,this._track._backing.getFirstPacket(e),e)}async getFirstKeyPacket(e={}){ct(e);let r=await this.getFirstPacket(e);return r?r.type===\"key\"?r:this.getNextKeyPacket(r,e):null}async getPacket(e,r={}){if(ls(e),ct(r),this._track.input._disposed)throw new ee;return yi(this._track,this._track._backing.getPacket(e,r),r)}async getNextPacket(e,r={}){if(!(e instanceof G))throw new TypeError(\"packet must be an EncodedPacket.\");if(ct(r),this._track.input._disposed)throw new ee;return yi(this._track,this._track._backing.getNextPacket(e,r),r)}async getKeyPacket(e,r={}){if(ls(e),ct(r),this._track.input._disposed)throw new ee;if(!r.verifyKeyPackets)return this._track._backing.getKeyPacket(e,r);let i=await this._track._backing.getKeyPacket(e,r);return i&&(p(i.type===\"key\"),await this._track.determinePacketType(i)===\"delta\"?this.getKeyPacket(i.timestamp-1/await this._track.getTimeResolution(),r):i)}async getNextKeyPacket(e,r={}){if(!(e instanceof G))throw new TypeError(\"packet must be an EncodedPacket.\");if(ct(r),this._track.input._disposed)throw new ee;if(!r.verifyKeyPackets)return this._track._backing.getNextKeyPacket(e,r);let i=await this._track._backing.getNextKeyPacket(e,r);return i&&(p(i.type===\"key\"),await this._track.determinePacketType(i)===\"delta\"?this.getNextKeyPacket(i,r):i)}packets(e,r,i={}){if(e!==void 0&&!(e instanceof G))throw new TypeError(\"startPacket must be an EncodedPacket.\");if(e!==void 0&&e.isMetadataOnly&&!i?.metadataOnly)throw new TypeError(\"startPacket can only be metadata-only if options.metadataOnly is enabled.\");if(r!==void 0&&!(r instanceof G))throw new TypeError(\"endPacket must be an EncodedPacket.\");if(ct(i),this._track.input._disposed)throw new ee;let s=[],{promise:o,resolve:n}=Ke(),{promise:a,resolve:c}=Ke(),l=!1,u=!1,d=null,f=!1,h=[],m=()=>Math.max(2,h.length);(async()=>{let y=e??await this.getFirstPacket(i);for(;y&&!u&&!this._track.input._disposed&&!(r&&y.sequenceNumber>=r?.sequenceNumber);){if(s.length>m()){({promise:a,resolve:c}=Ke()),await a;continue}s.push(y),n(),{promise:o,resolve:n}=Ke(),y=await this.getNextPacket(y,i)}l=!0,n()})().catch(y=>{f||(d=y,f=!0,n())});let g=this._track;return{async next(){for(;;){if(g.input._disposed)throw new ee;if(u)return{value:void 0,done:!0};if(f)throw d;if(s.length>0){let y=s.shift(),w=performance.now();for(h.push(w);h.length>0&&w-h[0]>=1e3;)h.shift();return c(),{value:y,done:!1}}else{if(l)return{value:void 0,done:!0};await o}}},async return(){return u=!0,c(),n(),{value:void 0,done:!0}},async throw(y){throw y},[Symbol.asyncIterator](){return this}}}};var Ct=class t{constructor(e,r){this.input=e,this._backing=r}isVideoTrack(){return this instanceof Et}isAudioTrack(){return this instanceof It}get id(){return this._backing.getId()}get number(){return this._backing.getNumber()}async getInternalCodecId(){return this._backing.getInternalCodecId()}get internalCodecId(){return q(this._backing.getInternalCodecId(),\"internalCodecId\",\"getInternalCodecId\")}async getLanguageCode(){return this._backing.getLanguageCode()}get languageCode(){return q(this._backing.getLanguageCode(),\"languageCode\",\"getLanguageCode\")}async getName(){return this._backing.getName()}get name(){return q(this._backing.getName(),\"name\",\"getName\")}async getTimeResolution(){return this._backing.getTimeResolution()}get timeResolution(){return q(this._backing.getTimeResolution(),\"timeResolution\",\"getTimeResolution\")}async isRelativeToUnixEpoch(){return this._backing.isRelativeToUnixEpoch()}async getUnixTimeForTimestamp(e){return this._backing.getUnixTimeForTimestamp(e)}async hasUnixTimeMapping(){return await this._backing.getUnixTimeForTimestamp(await this.getFirstTimestamp())!==null}async getDisposition(){return this._backing.getDisposition()}get disposition(){return q(this._backing.getDisposition(),\"disposition\",\"getDisposition\")}async getBitrate(){return this._backing.getBitrate()}async getAverageBitrate(){return this._backing.getAverageBitrate()}async getFirstTimestamp(){return(await this._backing.getFirstPacket({metadataOnly:!0}))?.timestamp??0}async computeDuration(e){let r=await this._backing.getPacket(1/0,{metadataOnly:!0,...e}),i=(r?.timestamp??0)+(r?.duration??0);return Qi(i,await this.getTimeResolution())}async getDurationFromMetadata(e={}){return this._backing.getDurationFromMetadata(e)}async computePacketStats(e=1/0,r){let i=new Xe(this),s=1/0,o=-1/0,n=0,a=0;for await(let c of i.packets(void 0,void 0,{metadataOnly:!0,...r})){if(n>=e&&c.timestamp>=o)break;s=Math.min(s,c.timestamp),o=Math.max(o,c.timestamp+c.duration),n++,a+=c.byteLength}return{packetCount:n,averagePacketRate:n?Number((n/(o-s)).toPrecision(16)):0,averageBitrate:n?Number((8*a/(o-s)).toPrecision(16)):0}}async isLive(){return await this._backing.getLiveRefreshInterval()!==null}async getLiveRefreshInterval(){return this._backing.getLiveRefreshInterval()}canBePairedWith(e){if(!(e instanceof t))throw new TypeError(\"other must be an InputTrack.\");return this.input!==e.input||this===e?!1:(this._backing.getPairingMask()&e._backing.getPairingMask())!==0n}async getPairableTracks(e){return this.input.getTracks(Ze({filter:r=>r.canBePairedWith(this)},e))}async getPairableVideoTracks(e){return this.input.getVideoTracks(Ze({filter:r=>r.canBePairedWith(this)},e))}async getPairableAudioTracks(e){return this.input.getAudioTracks(Ze({filter:r=>r.canBePairedWith(this)},e))}async getPrimaryPairableVideoTrack(e){return this.input.getPrimaryVideoTrack(Ze({filter:r=>r.canBePairedWith(this)},e))}async getPrimaryPairableAudioTrack(e){return this.input.getPrimaryAudioTrack(Ze({filter:r=>r.canBePairedWith(this)},e))}async hasPairableTrack(e){e&&=wi(e);let r=await this.input.getTracks();for(let i of r)if(this.canBePairedWith(i)&&(!e||await e(i)))return!0;return!1}hasPairableVideoTrack(e){return e&&=wi(e),this.hasPairableTrack(async r=>r.isVideoTrack()&&(!e||await e(r)))}hasPairableAudioTrack(e){return e&&=wi(e),this.hasPairableTrack(async r=>r.isAudioTrack()&&(!e||await e(r)))}},q=(t,e,r)=>{if(F(t))throw new Error(`'${e}' is deprecated and not available synchronously for this track. Use the preferred '${r}()' instead.`);return t},wi=t=>{if(t!==void 0&&typeof t!=\"function\")throw new TypeError(\"predicate, when provided, must be a function.\");return t?e=>{let r=s=>{if(typeof s!=\"boolean\")throw new TypeError(\"predicate must return or resolve to a boolean value.\");return s},i=t(e);return F(i)?i.then(r):r(i)}:void 0},Et=class extends Ct{constructor(e,r){super(e,r),this._pixelAspectRatioCache=null}get type(){return\"video\"}async getCodec(){return this._backing.getCodec()}get codec(){return q(this._backing.getCodec(),\"codec\",\"getCodec\")}async hasOnlyKeyPackets(){return await this._backing.getHasOnlyKeyPackets?.()??await this._backing.getCodec()===\"prores\"}async getCodedWidth(){return this._backing.getCodedWidth()}get codedWidth(){return q(this._backing.getCodedWidth(),\"codedWidth\",\"getCodedWidth\")}async getCodedHeight(){return this._backing.getCodedHeight()}get codedHeight(){return q(this._backing.getCodedHeight(),\"codedHeight\",\"getCodedHeight\")}async getTransformationMatrix(){return this._backing.getTransformationMatrix()}async getRotation(){return qt(await this._backing.getTransformationMatrix())}get rotation(){return qt(q(this._backing.getTransformationMatrix(),\"rotation\",\"getRotation\"))}async getFlip(){return Nr(await this._backing.getTransformationMatrix())}async getSquarePixelWidth(){return this._backing.getSquarePixelWidth()}get squarePixelWidth(){return q(this._backing.getSquarePixelWidth(),\"squarePixelWidth\",\"getSquarePixelWidth\")}async getSquarePixelHeight(){return this._backing.getSquarePixelHeight()}get squarePixelHeight(){return q(this._backing.getSquarePixelHeight(),\"squarePixelHeight\",\"getSquarePixelHeight\")}async getPixelAspectRatio(){return this._pixelAspectRatioCache??=yt({num:await this.getSquarePixelWidth()*await this.getCodedHeight(),den:await this.getSquarePixelHeight()*await this.getCodedWidth()})}get pixelAspectRatio(){return this._pixelAspectRatioCache??=yt({num:q(this._backing.getSquarePixelWidth(),\"pixelAspectRatio\",\"getPixelAspectRatio\")*q(this._backing.getCodedHeight(),\"pixelAspectRatio\",\"getPixelAspectRatio\"),den:q(this._backing.getSquarePixelHeight(),\"pixelAspectRatio\",\"getPixelAspectRatio\")*q(this._backing.getCodedWidth(),\"pixelAspectRatio\",\"getPixelAspectRatio\")})}async getDisplayWidth(){let e=await this._backing.getMetadataDisplayWidth?.();return e??(await this.getRotation()%180===0?this.getSquarePixelWidth():this.getSquarePixelHeight())}get displayWidth(){let e=this._backing.getMetadataDisplayWidth?.();if(e!==void 0){let s=q(e,\"displayWidth\",\"getDisplayWidth\");if(s!==null)return s}let i=qt(q(this._backing.getTransformationMatrix(),\"displayWidth\",\"getDisplayWidth\"))%180===0?this._backing.getSquarePixelWidth():this._backing.getSquarePixelHeight();return q(i,\"displayWidth\",\"getDisplayWidth\")}async getDisplayHeight(){let e=await this._backing.getMetadataDisplayHeight?.();return e??(await this.getRotation()%180===0?this.getSquarePixelHeight():this.getSquarePixelWidth())}get displayHeight(){let e=this._backing.getMetadataDisplayHeight?.();if(e!==void 0){let s=q(e,\"displayHeight\",\"getDisplayHeight\");if(s!==null)return s}let i=qt(q(this._backing.getTransformationMatrix(),\"displayHeight\",\"getDisplayHeight\"))%180===0?this._backing.getSquarePixelHeight():this._backing.getSquarePixelWidth();return q(i,\"displayHeight\",\"getDisplayHeight\")}async getColorSpace(){return this._backing.getColorSpace()}async hasHighDynamicRange(){let e=await this._backing.getColorSpace();return e.primaries===\"bt2020\"||e.primaries===\"smpte432\"||e.transfer===\"pq\"||e.transfer===\"hlg\"||e.matrix===\"bt2020-ncl\"}async canBeTransparent(){return this._backing.canBeTransparent()}async getDecoderConfig(){return this._backing.getDecoderConfig()}async getCodecParameterString(){let e=await this._backing.getMetadataCodecParameterString?.();return e??(await this._backing.getDecoderConfig())?.codec??null}async canDecode(){try{let e=await this._backing.getDecoderConfig();if(!e)return!1;let r=await this._backing.getCodec();return p(r!==null),as.some(s=>s.supports(r,e))?!0:typeof VideoDecoder>\"u\"?!1:(await VideoDecoder.isConfigSupported(e)).supported===!0}catch(e){return R._error(\"Error during decodability check:\",e),!1}}async determinePacketType(e){if(!(e instanceof G))throw new TypeError(\"packet must be an EncodedPacket.\");if(e.isMetadataOnly)throw new TypeError(\"packet must not be metadata-only to determine its type.\");let r=await this.getCodec();if(r===null)return null;let i=await this.getDecoderConfig();return p(i),Tn(r,i,e.data)}async computeFrameRateMetrics(e={}){if(!e||typeof e!=\"object\")throw new TypeError(\"options must be an object.\");if(e.targetPacketCount!==void 0&&(!it(e.targetPacketCount)||e.targetPacketCount<0))throw new TypeError(\"options.targetPacketCount must be a non-negative number.\");let r=await this.getTimeResolution(),i=e.targetPacketCount??256,s=new Xe(this),o=[],n=-1/0,a=0;for await(let I of s.packets(void 0,void 0,{metadataOnly:!0})){if(o.length>=i&&I.timestamp>=n)break;o.push(I.timestamp),n=Math.max(n,I.timestamp),a++}let c=new Float64Array(o.length);for(let I=0;I<o.length;I++)c[I]=Math.round(o[I]*r);c.sort();let l=1;for(let I=1;I<c.length;I++)c[I]!==c[l-1]&&(c[l++]=c[I]);if(l<2)return{underlyingFrameRate:null,bestGuessFrameRate:r,minFrameRate:r,maxFrameRate:r,averageFrameRate:r,medianFrameRate:r,frameRateIsConstant:!0,probedPacketCount:a};let u=c.subarray(0,l),d=Eo(u,r),f=d??r,h=d!==null?r/d:null,m=new Map,g=1/0,y=-1/0,w=0;for(let I=1;I<l;I++){let j=u[I]-u[I-1],z=h!==null?Math.max(1,Math.round(j/h)):j;m.set(z,(m.get(z)??0)+1),g=Math.min(g,z),y=Math.max(y,z),w+=z}let A=l-1,x=[...m.keys()].sort((I,j)=>I-j),v=A-1>>1,U=A>>1,M=0,_=0,E=0;for(let I of x)if(E+=m.get(I),M===0&&E>v&&(M=I),E>U){_=I;break}let N=(f/M+f/_)/2;return{underlyingFrameRate:d,bestGuessFrameRate:d!==null?d:Io(N),minFrameRate:f/y,maxFrameRate:f/g,averageFrameRate:f*A/w,medianFrameRate:N,frameRateIsConstant:d!==null&&g===1&&y===1,probedPacketCount:a}}},It=class extends Ct{constructor(e,r){super(e,r)}get type(){return\"audio\"}async getCodec(){return this._backing.getCodec()}get codec(){return q(this._backing.getCodec(),\"codec\",\"getCodec\")}async hasOnlyKeyPackets(){return await this._backing.getHasOnlyKeyPackets?.()??!0}async getNumberOfChannels(){return this._backing.getNumberOfChannels()}get numberOfChannels(){return q(this._backing.getNumberOfChannels(),\"numberOfChannels\",\"getNumberOfChannels\")}async getSampleRate(){return this._backing.getSampleRate()}get sampleRate(){return q(this._backing.getSampleRate(),\"sampleRate\",\"getSampleRate\")}async getDecoderConfig(){return this._backing.getDecoderConfig()}async getCodecParameterString(){let e=await this._backing.getMetadataCodecParameterString?.();return e??(await this._backing.getDecoderConfig())?.codec??null}async canDecode(){try{let e=await this._backing.getDecoderConfig();if(!e)return!1;let r=await this._backing.getCodec();return p(r!==null),cs.some(i=>i.supports(r,e))||ie.includes(e.codec)?!0:typeof AudioDecoder>\"u\"?!1:(await AudioDecoder.isConfigSupported(e)).supported===!0}catch(e){return R._error(\"Error during decodability check:\",e),!1}}async determinePacketType(e){if(!(e instanceof G))throw new TypeError(\"packet must be an EncodedPacket.\");return await this.getCodec()===null?null:\"key\"}};var Ai=t=>-(t??-1/0),vt=t=>-t,Bt=t=>{if(typeof t!=\"object\"||!t)throw new TypeError(\"query must be an object.\");if(t.filter!==void 0&&typeof t.filter!=\"function\")throw new TypeError(\"query.filter, when provided, must be a function.\");if(t.sortBy!==void 0&&typeof t.sortBy!=\"function\")throw new TypeError(\"query.sortBy, when provided, must be a function.\");return{filter:t.filter?e=>{let r=s=>{if(typeof s!=\"boolean\")throw new TypeError(\"query.filter must return or resolve to a boolean.\");return s},i=t.filter(e);return F(i)?i.then(r):r(i)}:void 0,sortBy:t.sortBy?e=>{let r=s=>{if(typeof s!=\"number\"&&(!Array.isArray(s)||!s.every(o=>typeof o==\"number\")))throw new TypeError(\"query.sortBy must return or resolve to a number or an array of numbers.\");return s},i=t.sortBy(e);return F(i)?i.then(r):r(i)}:void 0}},Ze=(t,e)=>({filter:t?.filter||e?.filter?r=>{let i=t?.filter?.(r)??!0,s=o=>o===!1?!1:e?.filter?.(r)??!0;return F(i)?i.then(s):s(i)}:void 0,sortBy:t?.sortBy||e?.sortBy?r=>{let i=t?.sortBy?.(r)??[],s=e?.sortBy?.(r)??[],o=(n,a)=>[...Array.isArray(n)?n:[n],...Array.isArray(a)?a:[a]];return F(i)||F(s)?Promise.all([i,s]).then(([n,a])=>o(n,a)):o(i,s)}:void 0}),Fr=async(t,e)=>{let r=t;if(e?.filter){let n=t.map(c=>e.filter(c));if(n.some(c=>F(c))){let c=await Promise.all(n);r=t.filter((l,u)=>c[u])}else r=t.filter((c,l)=>n[l])}if(!e?.sortBy)return r;let i=r.map(n=>e.sortBy(n)),o=i.some(n=>F(n))?await Promise.all(i):i;return r.map((n,a)=>({track:n,sortValue:o[a]})).sort((n,a)=>{let c=Array.isArray(n.sortValue)?n.sortValue:[n.sortValue],l=Array.isArray(a.sortValue)?a.sortValue:[a.sortValue],u=Math.max(c.length,l.length);for(let d=0;d<u;d++){let f=c[d]??0,h=l[d]??0;if(f!==h)return f-h}return 0}).map(n=>n.track)},Eo=(t,e)=>{let s=1.000000001,o=1e3,n=[12,15,20,24e3/1001,24,25,3e4/1001,30,48,50,6e4/1001,60,100,12e4/1001,120,144,240];if(t.length<2)return null;let a=new Float64Array(t.length-1);for(let _=1;_<t.length;_++){let E=t[_]-t[_-1];if(!(E>0))return null;a[_-1]=E}let c=a.slice();c.sort();let l=c[Math.floor(c.length*.05)];for(let _=0;_<6;_++){let E=0,N=0;for(let j of a){let z=Math.max(1,Math.round(j/l));Math.abs(j-z*l)>=s||(E+=j,N+=z)}if(N===0)return null;let I=E/N;if(Math.abs(I-l)<=1e-12*Math.max(1,l)){l=I;break}l=I}let u=0,d=0,f=0;for(let _ of a){let E=Math.max(1,Math.round(_/l));Math.abs(_-E*l)>=s||(u++,d+=_,f+=E)}if(u/a.length<.98)return null;l=d/f;let h=1/Math.min(f,o),m=Math.max(Number.EPSILON,l-h),g=l+h,y=e/g,w=e/m,A=e/l,x=null,v=1/0;for(let _ of n){if(_<y||_>w)continue;let E=Math.abs(_/A-1);E<v&&(x=_,v=E)}if(x===null){let _=us(m,g,1e6),E=us(y,w,1e6);if(E&&(!_||E.den<_.den||E.den===_.den&&E.num<=_.num))x=E.num/E.den;else if(_)x=e*_.den/_.num;else return null}let U=e/x,M=0;for(let _ of a){let E=Math.max(1,Math.round(_/U));Math.abs(_-E*U)<s&&M++}return M/a.length<.98?null:x},us=(t,e,r)=>{for(let i=1;i<=r;i++){let s=Math.floor(t*i)+1;if(s/i<e)return yt({num:s,den:i})}return null},Io=t=>{let e=[23.976023976023978,29.970029970029973,59.940059940059946,119.88011988011989],r=[12,15,20,24,25,30,48,50,60,100,120,144,240],i=5e-4,s=.025;for(let a of e)if(Math.abs(a/t-1)<=i)return a;let o=t,n=1/0;for(let a of r){let c=Math.abs(a/t-1);c<=s&&c<n&&(o=a,n=c)}return o};ar();var vo=1;var Pt=class t extends de{get disposed(){return this._disposed}constructor(e){if(super(),this._demuxerPromise=null,this._format=null,this._trackBackingsCache=null,this._backingToTrack=new Map,this._disposed=!1,this._nextSourceCacheAge=0,this._sourceRefs=[],this._sourceCache=[],this._sourceCachePromises=[],this._onFormatDetermined=null,!e||typeof e!=\"object\")throw new TypeError(\"options must be an object.\");if(!Array.isArray(e.formats)||e.formats.some(r=>!(r instanceof _t)))throw new TypeError(\"options.formats must be an array of InputFormat.\");if(!(e.source instanceof he||e.source instanceof at))throw new TypeError(\"options.source must be a Source or SourceRef.\");if(e.source instanceof he&&e.source._disposed)throw new TypeError(\"options.source must not be a disposed Source.\");if(e.initInput!==void 0&&!(e.initInput instanceof t))throw new TypeError(\"options.initInput, when provided, must be an Input.\");e.formatOptions!==void 0&&os(e.formatOptions,\"formatOptions\"),this._formats=e.formats,this._initInput=e.initInput??null,this._formatOptions=e.formatOptions??{},e.source instanceof he?this._rootRef=e.source.ref():this._rootRef=e.source,this._sourceRefs.push(this._rootRef)}get _rootSource(){return this._rootRef.source}async _getSourceUncached(e){p(this._rootSource instanceof Xt);let r=await this._rootSource._resolveRequest(e);return this._emit(\"source\",{source:r.source,request:e,isRoot:e.isRoot}),r}_getSourceCached(e,r=vo){let i=this._sourceCache.find(n=>n.cacheGroup===r&&gi(n.request,e));if(i)return i.age++,Promise.resolve(i.sourceRef.source.ref());let s=this._sourceCachePromises.find(n=>n.cacheGroup===r&&gi(n.request,e));if(s)return s.promise.then(n=>n.sourceRef.source.ref());let o=(async()=>{let n=await this._getSourceUncached(e);if($i(this._sourceCache,d=>d.cacheGroup===r&&d.sourceRef.source._refCount===1)>=4){let d=Gi(this._sourceCache,h=>h.cacheGroup===r&&h.sourceRef.source._refCount===1?h.age:1/0);p(d!==-1);let f=this._sourceCache[d];this._sourceCache.splice(d,1),f.sourceRef.free(),Gr(this._sourceRefs,f.sourceRef)}this._sourceRefs.push(n);let l=this._sourceCachePromises.findIndex(d=>d.request===e);return p(l!==-1),this._sourceCachePromises.splice(l,1),{request:e,sourceRef:n,age:this._nextSourceCacheAge++,cacheGroup:r}})();return this._sourceCachePromises.push({request:e,cacheGroup:r,promise:o}),o.then(n=>{let a=n.sourceRef.source.ref();return this._sourceCache.push(n),a})}_getDemuxer(){return this._demuxerPromise??=(async()=>{this._reader=new Mr(this._rootSource),this._emit(\"source\",{source:this._rootSource,request:null,isRoot:!0});for(let e of this._formats)if(await e._canReadInput(this))return this._format=e,this._onFormatDetermined?.(e),e._createDemuxer(this);throw new Zt})()}get source(){return this._rootSource}async getFormat(){return await this._getDemuxer(),p(this._format),this._format}async canRead(){try{return await this._getDemuxer(),!0}catch(e){if(e instanceof Zt)return!1;throw e}}async getFirstTimestamp(e){e??=await this.getTracks();let r=e.filter(o=>o!==null);if(r.length===0)return 0;let i=await Promise.all(r.map(o=>o._backing.getFirstPacket({metadataOnly:!0}))),s=Math.min(...i.map(o=>o?.timestamp??1/0));return s===1/0?0:s}async computeDuration(e,r){e??=await this.getTracks();let i=e.filter(o=>o!==null);if(i.length===0)return 0;let s=await Promise.all(i.map(o=>o.computeDuration(r)));return Math.max(...s)}async getDurationFromMetadata(e,r){e??=await this.getTracks();let i=e.filter(n=>n!==null),o=(await Promise.all(i.map(n=>n.getDurationFromMetadata(r)))).filter(n=>n!==null);return o.length===0?null:Math.max(...o)}async getTracks(e){e&&=Bt(e);let i=(await this._getTrackBackings()).map(s=>this._wrapBackingAsTrack(s));return Fr(i,e)}async getVideoTracks(e){e&&=Bt(e);let i=(await this.getTracks()).filter(s=>s.isVideoTrack());return Fr(i,e)}async getAudioTracks(e){e&&=Bt(e);let i=(await this.getTracks()).filter(s=>s.isAudioTrack());return Fr(i,e)}async getPrimaryVideoTrack(e){e&&=Bt(e);let r=Ze(e,{sortBy:async s=>[vt((await s.getDisposition()).default),vt(await s.hasPairableAudioTrack()),vt(!await s.hasOnlyKeyPackets()),Ai(await s.getBitrate())]});return(await this.getVideoTracks(r))[0]??null}async getPrimaryAudioTrack(e){e&&=Bt(e);let r=await this.getPrimaryVideoTrack(),i=Ze(e,{sortBy:async o=>[vt(!r||o.canBePairedWith(r)),vt((await o.getDisposition()).default),Ai(await o.getBitrate())]});return(await this.getAudioTracks(i))[0]??null}async _getTrackBackings(){let e=await this._getDemuxer();return this._trackBackingsCache??=await e.getTrackBackings()}_wrapBackingAsTrack(e){let r=this._backingToTrack.get(e);if(r)return r;let s=e.getType()===\"video\"?new Et(this,e):new It(this,e);return this._backingToTrack.set(e,s),s}async getMimeType(){return(await this._getDemuxer()).getMimeType()}async getMetadataTags(){return(await this._getDemuxer()).getMetadataTags()}dispose(){if(!this._disposed){this._disposed=!0;for(let e of this._sourceRefs)e.free();this._sourceRefs.length=0,this._demuxerPromise&&this._demuxerPromise.then(e=>e.dispose()).catch(()=>{})}}[Symbol.dispose](){this.dispose()}},Zt=class extends Error{constructor(e=\"Input has an unsupported or unrecognizable format.\"){super(e),this.name=\"UnsupportedInputFormatError\"}},ee=class extends Error{constructor(e=\"Input has been disposed.\"){super(e),this.name=\"InputDisposedError\"}};var Mr=class{constructor(e){this.source=e}get fileSize(){let e=this.source._getFileSize();if(e===void 0)throw new Error(\"Reading file size too early; read required first.\");return e}get fileSizeNonStrict(){return this.source._getFileSize()??null}requestSlice(e,r){if(this.source._disposed)throw new ee;if(e<0||this.fileSizeNonStrict!==null&&e+r>this.fileSizeNonStrict)return null;if(r===0){let o=new Uint8Array(0);return new Ue(o,H(o),0,e,e)}let i=e+r,s=this.source._read(e,i,mi,pi);return F(s)?s.then(o=>o?new Ue(o.bytes,o.view,o.offset,e,i):null):s?new Ue(s.bytes,s.view,s.offset,e,i):null}requestSliceRange(e,r,i){if(this.source._disposed)throw new ee;if(e<0)return null;if(this.fileSizeNonStrict!==null)return this.requestSlice(e,gt(this.fileSizeNonStrict-e,r,i));{let s=this.requestSlice(e,i),o=n=>n||(p(this.fileSizeNonStrict!==null),this.requestSlice(e,gt(this.fileSizeNonStrict-e,r,i)));return F(s)?s.then(o):o(s)}}requestEntireFile(){if(this.fileSizeNonStrict!==null)return this.requestSlice(0,this.fileSizeNonStrict);let e=1024;return(async()=>{let r=[],i=0;for(;;){if(r.length===1&&this.fileSizeNonStrict!==null)return this.requestSlice(0,this.fileSizeNonStrict);let n=this.requestSliceRange(i,0,e);if(F(n)&&(n=await n),!n||n.length===0)break;let a=L(n,n.length);r.push(a),i+=n.length}let s=new Uint8Array(i),o=0;for(let n of r)s.set(n,o),o+=n.length;return new Ue(s,H(s),0,0,i)})()}},Ue=class t{constructor(e,r,i,s,o){this.bytes=e,this.view=r,this.offset=i,this.start=s,this.end=o,this.bufferPos=s-i}static tempFromBytes(e){return new t(e,H(e),0,0,e.length)}get length(){return this.end-this.start}get filePos(){return this.offset+this.bufferPos}set filePos(e){this.bufferPos=e-this.offset}get remainingLength(){return Math.max(this.end-this.filePos,0)}skip(e){this.bufferPos+=e}slice(e,r=this.end-e){if(e<this.start||e+r>this.end)throw new RangeError(\"Slicing outside of original slice.\");return new t(this.bytes,this.view,this.offset,e,e+r)}},Le=(t,e)=>{if(t.filePos<t.start||t.filePos+e>t.end)throw new RangeError(`Tried reading [${t.filePos}, ${t.filePos+e}), but slice is [${t.start}, ${t.end}). This is likely an internal error, please report it alongside the file that caused it.`)},L=(t,e)=>{Le(t,e);let r=t.bytes.subarray(t.bufferPos,t.bufferPos+e);return t.bufferPos+=e,r},P=t=>(Le(t,1),t.view.getUint8(t.bufferPos++));var X=t=>{Le(t,2);let e=t.view.getUint16(t.bufferPos,!1);return t.bufferPos+=2,e},De=t=>{Le(t,3);let e=Ht(t.view,t.bufferPos,!1);return t.bufferPos+=3,e},es=t=>{Le(t,2);let e=t.view.getInt16(t.bufferPos,!1);return t.bufferPos+=2,e};var T=t=>{Le(t,4);let e=t.view.getUint32(t.bufferPos,!1);return t.bufferPos+=4,e};var Oe=t=>{Le(t,4);let e=t.view.getInt32(t.bufferPos,!1);return t.bufferPos+=4,e};var te=t=>{let e=T(t),r=T(t);return e*4294967296+r},ts=t=>{let e=Oe(t),r=T(t);return e*4294967296+r};var rs=t=>{Le(t,8);let e=t.view.getFloat64(t.bufferPos,!1);return t.bufferPos+=8,e},se=(t,e)=>{Le(t,e);let r=\"\";for(let i=0;i<e;i++)r+=String.fromCharCode(t.bytes[t.bufferPos++]);return r};var Or=class{constructor(e){this.mutex=new mt,this.trackTimestampInfo=new WeakMap,this.output=e}onTrackClose(e){}validateTimestamp(e,r,i){let s=this.trackTimestampInfo.get(e);if(s){if(i&&(s.maxTimestampBeforeLastKeyPacket=s.maxTimestamp),s.maxTimestampBeforeLastKeyPacket!==null&&r<s.maxTimestampBeforeLastKeyPacket)throw new Error(`Timestamps cannot be smaller than the largest timestamp of the previous GOP (a GOP begins with a key packet and ends right before the next key packet). Got ${r}s, but largest timestamp is ${s.maxTimestampBeforeLastKeyPacket}s.`);s.maxTimestamp=Math.max(s.maxTimestamp,r)}else{if(!i)throw new Error(\"First packet must be a key packet.\");s={maxTimestamp:r,maxTimestampBeforeLastKeyPacket:null},this.trackTimestampInfo.set(e,s)}}};var bi=/<(?:(\\d{2}):)?(\\d{2}):(\\d{2}).(\\d{3})>/g;var ds=t=>{let e=Math.floor(t/36e5),r=Math.floor(t%(3600*1e3)/(60*1e3)),i=Math.floor(t%(60*1e3)/1e3),s=t%1e3;return e.toString().padStart(2,\"0\")+\":\"+r.toString().padStart(2,\"0\")+\":\"+i.toString().padStart(2,\"0\")+\".\"+s.toString().padStart(3,\"0\")};var lt=class{constructor(e){this.writer=e,this.helper=new Uint8Array(8),this.helperView=new DataView(this.helper.buffer),this.offsets=new WeakMap}writeU32(e){this.helperView.setUint32(0,e,!1),this.writer.write(this.helper.subarray(0,4))}writeU64(e){this.helperView.setUint32(0,Math.floor(e/2**32),!1),this.helperView.setUint32(4,e,!1),this.writer.write(this.helper.subarray(0,8))}writeAscii(e){for(let r=0;r<e.length;r++)this.helperView.setUint8(r%8,e.charCodeAt(r)),r%8===7&&this.writer.write(this.helper);e.length%8!==0&&this.writer.write(this.helper.subarray(0,e.length%8))}writeBox(e){if(this.offsets.set(e,this.writer.getPos()),e.contents&&!e.children)this.writeBoxHeader(e,e.size??e.contents.byteLength+8),this.writer.write(e.contents);else{let r=this.writer.getPos();if(this.writeBoxHeader(e,0),e.contents&&this.writer.write(e.contents),e.children)for(let o of e.children)o&&this.writeBox(o);let i=this.writer.getPos(),s=e.size??i-r;this.writer.seek(r),this.writeBoxHeader(e,s),this.writer.seek(i)}}writeBoxHeader(e,r){this.writeU32(e.largeSize?1:r),this.writeAscii(e.type),e.largeSize&&this.writeU64(r)}measureBoxHeader(e){return 8+(e.largeSize?8:0)}patchBox(e){let r=this.offsets.get(e);p(r!==void 0);let i=this.writer.getPos();this.writer.seek(r),this.writeBox(e),this.writer.seek(i)}measureBox(e){if(e.contents&&!e.children)return this.measureBoxHeader(e)+e.contents.byteLength;{let r=this.measureBoxHeader(e);if(e.contents&&(r+=e.contents.byteLength),e.children)for(let i of e.children)i&&(r+=this.measureBox(i));return r}}},B=new Uint8Array(8),pe=new DataView(B.buffer),Q=t=>[(t%256+256)%256],C=t=>(pe.setUint16(0,t,!1),[B[0],B[1]]),ki=t=>(pe.setInt16(0,t,!1),[B[0],B[1]]),ps=t=>(pe.setUint32(0,t,!1),[B[1],B[2],B[3]]),b=t=>(pe.setUint32(0,t,!1),[B[0],B[1],B[2],B[3]]),ve=t=>(pe.setInt32(0,t,!1),[B[0],B[1],B[2],B[3]]),Te=t=>(pe.setUint32(0,Math.floor(t/2**32),!1),pe.setUint32(4,t,!1),[B[0],B[1],B[2],B[3],B[4],B[5],B[6],B[7]]),fs=t=>(pe.setInt32(0,Math.floor(t/2**32),!1),pe.setUint32(4,t,!1),[B[0],B[1],B[2],B[3],B[4],B[5],B[6],B[7]]),gs=t=>(pe.setInt16(0,2**8*t,!1),[B[0],B[1]]),me=t=>(pe.setInt32(0,2**16*t,!1),[B[0],B[1],B[2],B[3]]),xi=t=>(pe.setInt32(0,2**30*t,!1),[B[0],B[1],B[2],B[3]]),Ti=(t,e)=>{let r=[],i=t;do{let s=i&127;i>>=7,r.length>0&&(s|=128),r.push(s),e!==void 0&&e--}while(i>0||e);return r.reverse()},V=(t,e=!1)=>{let r=Array(t.length).fill(null).map((i,s)=>t.charCodeAt(s));return e&&r.push(0),r},ys=t=>[me(t[0]),me(t[1]),xi(t[2]),me(t[3]),me(t[4]),xi(t[5]),me(t[6]),me(t[7]),xi(t[8])],k=(t,e,r)=>({type:t,contents:e&&new Uint8Array(e.flat(10)),children:r}),O=(t,e,r,i,s)=>k(t,[Q(e),ps(r),i??[]],s),ws=t=>t.isQuickTime?k(\"ftyp\",[V(\"qt  \"),b(512),V(\"qt  \")]):t.fragmented?t.cmaf?k(\"ftyp\",[V(\"iso5\"),b(512),V(\"iso5\"),V(\"iso6\"),V(\"mp41\"),V(\"cmfc\"),V(\"dash\")]):k(\"ftyp\",[V(\"iso5\"),b(512),V(\"iso5\"),V(\"iso6\"),V(\"mp41\")]):k(\"ftyp\",[V(\"isom\"),b(512),V(\"isom\"),t.holdsAvc?V(\"avc1\"):[],V(\"mp41\")]),_i=()=>k(\"styp\",[V(\"iso5\"),b(0),V(\"iso5\"),V(\"iso6\"),V(\"mp41\"),V(\"cmfc\"),V(\"dash\")]),Ci=(t,e)=>{let r=Math.max(0,t.minWrittenTimestamp),i=Math.max(0,t.maxWrittenEndTimestamp-r);return Number.isFinite(i)||(i=0),O(\"sidx\",1,0,[b(1),b(oe),Te(W(r,oe)),Te(0),C(0),C(1),b(e&2147483647),b(W(i,oe)),b(0)])},Yt=t=>({type:\"mdat\",largeSize:t}),As=t=>({type:\"free\",size:t}),Rt=t=>k(\"moov\",void 0,[Bo(t.creationTime,t.trackDatas),...t.trackDatas.map(e=>Po(e,t.creationTime)),t.isFragmented?ya(t.trackDatas):null,Ca(t)]),Bo=(t,e)=>{let r=Math.max(0,...e.map(n=>Math.max(0,W(ut(n),oe)+W(n.startTimestampOffset??0,oe)))),i=Math.max(0,...e.map(n=>n.track.id))+1,s=!ke(t)||!ke(r),o=s?Te:b;return O(\"mvhd\",+s,0,[o(t),o(t),b(oe),o(r),me(1),gs(1),Array(10).fill(0),ys(pt),Array(24).fill(0),b(i)])},Po=(t,e)=>{let r=Is(t),i=t.startTimestampOffset!==null&&t.startTimestampOffset!==0;return k(\"trak\",void 0,[Ro(t,e),i?Fo(t):null,Mo(t,e),r.name!==void 0?k(\"udta\",void 0,[k(\"name\",[...fe.encode(r.name)])]):null])},Ro=(t,e)=>{let r=Math.max(0,W(ut(t),oe)+W(t.startTimestampOffset??0,oe)),i=!ke(e)||!ke(r),s=i?Te:b,o;if(t.type===\"video\"&&t.track.metadata.transformationMatrix)o=t.track.metadata.transformationMatrix;else if(t.type===\"video\"){let{rotation:c,flip:l}=t.track.metadata,u=ht(Oi(c??0),zi(l?-1:1,1));o=Mi(u,t.info.width,t.info.height)}else o=pt;let n=2;t.track.metadata.disposition?.default!==!1&&(n|=1);let a=t.type===\"video\"?0:t.type===\"audio\"?1:t.type===\"subtitle\"?2:Pe(t);return O(\"tkhd\",+i,n,[s(e),s(e),b(t.track.id),b(0),s(r),Array(8).fill(0),C(0),C(a),gs(t.type===\"audio\"?1:0),C(0),ys(o),me(t.type===\"video\"?t.info.width:0),me(t.type===\"video\"?t.info.height:0)])},Fo=t=>{let e=t.startTimestampOffset;if(p(e!==null),e>0){let r=W(e,oe),i=W(ut(t),oe),s=!ke(r)||!ke(i),o=s?Te:b,n=s?fs:ve;return k(\"edts\",void 0,[O(\"elst\",s?1:0,0,[b(2),o(r),n(-1),me(1),o(i),n(0),me(1)])])}else{let r=W(-e,t.timescale),i=Math.max(0,W(ut(t),oe)+W(e,oe)),s=!Di(r)||!ke(i),o=s?Te:b,n=s?fs:ve;return k(\"edts\",void 0,[O(\"elst\",s?1:0,0,[b(1),o(i),n(r),me(1)])])}},Mo=(t,e)=>k(\"mdia\",void 0,[Oo(t,e),Ei(!0,zo[t.type],Do[t.type]),Uo(t)]),Oo=(t,e)=>{let r=W(ut(t),t.timescale),i=!ke(e)||!ke(r),s=i?Te:b;return O(\"mdhd\",+i,0,[s(e),s(e),b(t.timescale),s(r),C(Es(t.track.metadata.languageCode??Qt)),C(0)])},zo={video:\"vide\",audio:\"soun\",subtitle:\"text\"},Do={video:\"MediabunnyVideoHandler\",audio:\"MediabunnySoundHandler\",subtitle:\"MediabunnyTextHandler\"},Ei=(t,e,r,i=\"\\0\\0\\0\\0\")=>O(\"hdlr\",0,0,[t?V(\"mhlr\"):b(0),V(e),V(i),b(0),b(0),V(r,!0)]),Uo=t=>k(\"minf\",void 0,[No[t.type](),qo(),jo(t)]),Lo=()=>O(\"vmhd\",0,1,[C(0),C(0),C(0),C(0)]),Vo=()=>O(\"smhd\",0,0,[C(0),C(0)]),Wo=()=>O(\"nmhd\",0,0),No={video:Lo,audio:Vo,subtitle:Wo},qo=()=>k(\"dinf\",void 0,[Ho()]),Ho=()=>O(\"dref\",0,0,[b(1)],[Qo()]),Qo=()=>O(\"url \",0,1),jo=t=>{let e=t.compositionTimeOffsetTable.length>1||t.compositionTimeOffsetTable.some(r=>r.sampleCompositionTimeOffset!==0);return k(\"stbl\",void 0,[Ko(t),ua(t),e?pa(t):null,e?ga(t):null,fa(t),ha(t),ma(t),da(t)])},Ko=t=>{let e;if(t.type===\"video\")e=$o(Ba(t.track.source._codec,t.info.decoderConfig.codec),t);else if(t.type===\"audio\"){let r=Cs(t.track.source._codec,t.info.decoderConfig.codec,t.muxer.isQuickTime);p(r),e=ea(r,t)}else t.type===\"subtitle\"&&(e=ca(Fa[t.track.source._codec],t));return p(e),O(\"stsd\",0,0,[b(1)],[e])},$o=(t,e)=>k(t,[Array(6).fill(0),C(1),C(0),C(0),Array(12).fill(0),C(e.info.width),C(e.info.height),b(4718592),b(4718592),b(0),C(1),Q(10),V(\"Mediabunny\"),Array(21).fill(0),C(e.info.hasAlphaChannel?32:24),ki(65535)],[Pa[e.track.source._codec]?.(e)??null,Go(e),Ui(e.info.decoderConfig.colorSpace)?null:Xo(e),Ii(e)]),Ii=t=>t.avgBitrate===0&&t.maxBitrate===0?null:k(\"btrt\",[b(0),b(t.maxBitrate),b(t.avgBitrate)]),Go=t=>t.info.pixelAspectRatio.num===t.info.pixelAspectRatio.den?null:k(\"pasp\",[b(t.info.pixelAspectRatio.num),b(t.info.pixelAspectRatio.den)]),Xo=t=>{let e=t.info.decoderConfig.colorSpace;return k(\"colr\",[V(t.muxer.isQuickTime?\"nclc\":\"nclx\"),C(e?.primaries!=null?et[e.primaries]:2),C(e?.transfer!=null?tt[e.transfer]:2),C(e?.matrix!=null?rt[e.matrix]:2),t.muxer.isQuickTime?[]:Q((e?.fullRange?1:0)<<7)])},Zo=t=>t.info.decoderConfig&&k(\"avcC\",[...ae(t.info.decoderConfig.description)]),Yo=t=>t.info.decoderConfig&&k(\"hvcC\",[...ae(t.info.decoderConfig.description)]),hs=t=>{if(!t.info.decoderConfig)return null;let e=t.info.decoderConfig,r=e.codec.split(\".\"),i=Number(r[1]),s=Number(r[2]),o=Number(r[3]),n=r[4]?Number(r[4]):1,a=r[8]?Number(r[8]):Number(e.colorSpace?.fullRange??0),c=(o<<4)+(n<<1)+a,l=r[5]?Number(r[5]):e.colorSpace?.primaries?et[e.colorSpace.primaries]:1,u=r[6]?Number(r[6]):e.colorSpace?.transfer?tt[e.colorSpace.transfer]:1,d=r[7]?Number(r[7]):e.colorSpace?.matrix?rt[e.colorSpace.matrix]:1;return O(\"vpcC\",1,0,[Q(i),Q(s),Q(c),Q(l),Q(u),Q(d),C(0)])},Jo=t=>k(\"av1C\",Mn(t.info.decoderConfig.codec)),ea=(t,e)=>{let r=0,i,s=16,o=ie.includes(e.track.source._codec);if(o){let n=e.track.source._codec,{sampleSize:a}=we(n);s=8*a,s>16&&(r=1)}if(e.muxer.isQuickTime&&(r=1),r===0)i=[Array(6).fill(0),C(1),C(r),C(0),b(0),C(e.info.numberOfChannels),C(s),C(0),C(0),C(e.info.sampleRate<2**16?e.info.sampleRate:0),C(0)];else{let n=o?0:-2;i=[Array(6).fill(0),C(1),C(r),C(0),b(0),C(e.info.numberOfChannels),C(Math.min(s,16)),ki(n),C(0),C(e.info.sampleRate<2**16?e.info.sampleRate:0),C(0),o?[b(1),b(s/8),b(e.info.numberOfChannels*s/8)]:[b(0),b(0),b(0)],b(2)]}return k(t,i,[Ra(e.track.source._codec,e.muxer.isQuickTime)?.(e)??null,Ii(e)])},Si=t=>{let e;switch(t.track.source._codec){case\"aac\":e=64;break;case\"mp3\":e=107;break;case\"vorbis\":e=221;break;default:throw new Error(`Unhandled audio codec: ${t.track.source._codec}`)}let r=[...Q(e),...Q(21),...ps(0),...b(t.maxBitrate),...b(t.avgBitrate)];if(t.info.decoderConfig.description){let i=ae(t.info.decoderConfig.description);r=[...r,...Q(5),...Ti(i.byteLength),...i]}return r=[...C(1),...Q(0),...Q(4),...Ti(r.length),...r,...Q(6),...Q(1),...Q(2)],r=[...Q(3),...Ti(r.length),...r],O(\"esds\",0,0,r)},Ye=t=>k(\"wave\",void 0,[ta(t),ra(t),k(\"\\0\\0\\0\\0\")]),ta=t=>k(\"frma\",[V(Cs(t.track.source._codec,t.info.decoderConfig.codec,t.muxer.isQuickTime))]),ra=t=>{let{littleEndian:e}=we(t.track.source._codec);return k(\"enda\",[C(+e)])},ia=t=>{let e=t.info.numberOfChannels,r=3840,i=t.info.sampleRate,s=0,o=0,n=new Uint8Array(0),a=t.info.decoderConfig?.description;if(a){p(a.byteLength>=18);let c=ae(a),l=xn(c);e=l.outputChannelCount,r=l.preSkip,i=l.inputSampleRate,s=l.outputGain,o=l.channelMappingFamily,l.channelMappingTable&&(n=l.channelMappingTable)}return k(\"dOps\",[Q(0),Q(e),C(r),b(i),ki(s),Q(o),...n])},na=t=>{let e=t.info.decoderConfig?.description;p(e);let r=ae(e);return O(\"dfLa\",0,0,[...r.subarray(4)])},Ee=t=>{let{littleEndian:e,sampleSize:r}=we(t.track.source._codec),i=+e;return O(\"pcmC\",0,0,[Q(i),Q(8*r)])},sa=t=>{p(t.info.primingPacket);let e=Sn(t.info.primingPacket.data);if(!e)throw new Error(\"Couldn't extract AC-3 frame info from the audio packet. Ensure the packets contain valid AC-3 sync frames (as specified in ETSI TS 102 366).\");let r=new Uint8Array(3),i=new D(r);return i.writeBits(2,e.fscod),i.writeBits(5,e.bsid),i.writeBits(3,e.bsmod),i.writeBits(3,e.acmod),i.writeBits(1,e.lfeon),i.writeBits(5,e.bitRateCode),i.writeBits(5,0),k(\"dac3\",[...r])},oa=t=>{p(t.info.primingPacket);let e=kn(t.info.primingPacket.data);if(!e)throw new Error(\"Couldn't extract E-AC-3 frame info from the audio packet. Ensure the packets contain valid E-AC-3 sync frames (as specified in ETSI TS 102 366).\");let r=16;for(let n of e.substreams)r+=23,n.numDepSub>0?r+=9:r+=1;let i=Math.ceil(r/8),s=new Uint8Array(i),o=new D(s);o.writeBits(13,e.dataRate),o.writeBits(3,e.substreams.length-1);for(let n of e.substreams)o.writeBits(2,n.fscod),o.writeBits(5,n.bsid),o.writeBits(1,0),o.writeBits(1,0),o.writeBits(3,n.bsmod),o.writeBits(3,n.acmod),o.writeBits(1,n.lfeon),o.writeBits(3,0),o.writeBits(4,n.numDepSub),n.numDepSub>0?o.writeBits(9,n.chanLoc):o.writeBits(1,0);return k(\"dec3\",[...s])},aa=t=>{p(t.info.primingPacket);let e=li(t.info.primingPacket.data);if(!e)throw new Error(\"Couldn't extract DTS frame info from the audio packet. Ensure the packets contain valid DTS frames as specified in ETSI TS 102 114.\");return k(\"ddts\",[...Pn(e)])},ca=(t,e)=>k(t,[Array(6).fill(0),C(1)],[Ma[e.track.source._codec](e),Ii(e)]),la=t=>k(\"vttC\",[...fe.encode(t.info.config.description)]);var ua=t=>O(\"stts\",0,0,[b(t.timeToSampleTable.length),t.timeToSampleTable.map(e=>[b(e.sampleCount),b(e.sampleDelta)])]),da=t=>{if(t.samples.every(r=>r.type===\"key\"))return null;let e=[...t.samples.entries()].filter(([,r])=>r.type===\"key\");return O(\"stss\",0,0,[b(e.length),e.map(([r])=>b(r+1))])},fa=t=>O(\"stsc\",0,0,[b(t.compactlyCodedChunkTable.length),t.compactlyCodedChunkTable.map(e=>[b(e.firstChunk),b(e.samplesPerChunk),b(1)])]),ha=t=>{if(t.type===\"audio\"&&t.info.requiresPcmTransformation){let{sampleSize:e}=we(t.track.source._codec);return O(\"stsz\",0,0,[b(e*t.info.numberOfChannels),b(t.samples.reduce((r,i)=>r+W(i.duration,t.timescale),0))])}return O(\"stsz\",0,0,[b(0),b(t.samples.length),t.samples.map(e=>b(e.size))])},ma=t=>t.finalizedChunks.length>0&&Z(t.finalizedChunks).offset>=2**32?O(\"co64\",0,0,[b(t.finalizedChunks.length),t.finalizedChunks.map(e=>Te(e.offset))]):O(\"stco\",0,0,[b(t.finalizedChunks.length),t.finalizedChunks.map(e=>b(e.offset))]),pa=t=>O(\"ctts\",1,0,[b(t.compositionTimeOffsetTable.length),t.compositionTimeOffsetTable.map(e=>[b(e.sampleCount),ve(e.sampleCompositionTimeOffset)])]),ga=t=>{let e=1/0,r=-1/0,i=1/0,s=-1/0;p(t.compositionTimeOffsetTable.length>0),p(t.samples.length>0);for(let n=0;n<t.compositionTimeOffsetTable.length;n++){let a=t.compositionTimeOffsetTable[n];e=Math.min(e,a.sampleCompositionTimeOffset),r=Math.max(r,a.sampleCompositionTimeOffset)}for(let n=0;n<t.samples.length;n++){let a=t.samples[n];i=Math.min(i,W(a.timestamp,t.timescale)),s=Math.max(s,W(a.timestamp+a.duration,t.timescale))}let o=Math.max(-e,0);return s>=2**31?null:O(\"cslg\",0,0,[ve(o),ve(e),ve(r),ve(i),ve(s)])},ya=t=>k(\"mvex\",void 0,t.map(wa)),wa=t=>O(\"trex\",0,0,[b(t.track.id),b(1),b(0),b(0),b(0)]),vi=(t,e)=>k(\"moof\",void 0,[Aa(t),...e.map(ba)]),Aa=t=>O(\"mfhd\",0,0,[b(t)]),bs=t=>{let e=0,r=0,i=0,s=0,o=t.type===\"delta\";return r|=+o,o?e|=1:e|=2,e<<24|r<<16|i<<8|s},ba=t=>k(\"traf\",void 0,[xa(t),Ta(t),Sa(t)]),xa=t=>{p(t.currentChunk);let e=0;e|=8,e|=16,e|=32,e|=131072;let r=t.currentChunk.samples[1]??t.currentChunk.samples[0],i={duration:r.timescaleUnitsToNextSample,size:r.size,flags:bs(r)};return O(\"tfhd\",0,e,[b(t.track.id),b(i.duration),b(i.size),b(i.flags)])},Ta=t=>(p(t.currentChunk),O(\"tfdt\",1,0,[Te(W(t.currentChunk.startTimestamp,t.timescale))])),Sa=t=>{p(t.currentChunk);let e=t.currentChunk.samples.map(g=>g.timescaleUnitsToNextSample),r=t.currentChunk.samples.map(g=>g.size),i=t.currentChunk.samples.map(bs),s=t.currentChunk.samples.map(g=>W(g.timestamp-g.decodeTimestamp,t.timescale)),o=new Set(e),n=new Set(r),a=new Set(i),c=new Set(s),l=a.size===2&&i[0]!==i[1],u=o.size>1,d=n.size>1,f=!l&&a.size>1,h=c.size>1||[...c].some(g=>g!==0),m=0;return m|=1,m|=4*+l,m|=256*+u,m|=512*+d,m|=1024*+f,m|=2048*+h,O(\"trun\",1,m,[b(t.currentChunk.samples.length),b(t.currentChunk.offset-t.currentChunk.moofOffset||0),l?b(i[0]):[],t.currentChunk.samples.map((g,y)=>[u?b(e[y]):[],d?b(r[y]):[],f?b(i[y]):[],h?ve(s[y]):[]])])},xs=t=>k(\"mfra\",void 0,[...t.map(ka),_a()]),ka=t=>O(\"tfra\",1,0,[b(t.track.id),b(63),b(t.finalizedChunks.length),t.finalizedChunks.map(r=>[Te(W(r.samples[0].timestamp,t.timescale)),Te(r.moofOffset),b(r.trafIndex+1),b(1),b(1)])]),_a=()=>O(\"mfro\",0,0,[b(0)]),Ts=()=>k(\"vtte\"),Ss=(t,e,r,i,s)=>k(\"vttc\",void 0,[s!==null?k(\"vsid\",[ve(s)]):null,r!==null?k(\"iden\",[...fe.encode(r)]):null,e!==null?k(\"ctim\",[...fe.encode(ds(e))]):null,i!==null?k(\"sttg\",[...fe.encode(i)]):null,k(\"payl\",[...fe.encode(t)])]),ks=t=>k(\"vtta\",[...fe.encode(t)]),Ca=t=>{let e=[],r=t.format._options.metadataFormat??\"auto\",i=t.output._metadataTags;if(r===\"mdir\"||r===\"auto\"&&!t.isQuickTime){let s=Ia(i);s&&e.push(s)}else if(r===\"mdta\"){let s=va(i);s&&e.push(s)}else(r===\"udta\"||r===\"auto\"&&t.isQuickTime)&&Ea(e,t.output._metadataTags);return e.length===0?null:k(\"udta\",void 0,e)},Ea=(t,e)=>{for(let{key:r,value:i}of or(e))switch(r){case\"title\":t.push(Ie(\"\\xA9nam\",i));break;case\"description\":t.push(Ie(\"\\xA9des\",i));break;case\"artist\":t.push(Ie(\"\\xA9ART\",i));break;case\"album\":t.push(Ie(\"\\xA9alb\",i));break;case\"albumArtist\":t.push(Ie(\"albr\",i));break;case\"genre\":t.push(Ie(\"\\xA9gen\",i));break;case\"date\":t.push(Ie(\"\\xA9day\",i.toISOString().slice(0,10)));break;case\"comment\":t.push(Ie(\"\\xA9cmt\",i));break;case\"lyrics\":t.push(Ie(\"\\xA9lyr\",i));break;case\"raw\":break;case\"discNumber\":case\"discsTotal\":case\"trackNumber\":case\"tracksTotal\":case\"beatsPerMinute\":case\"images\":break;default:Pe(r)}if(e.raw)for(let r in e.raw){let i=e.raw[r];i==null||r.length!==4||t.some(s=>s.type===r)||(typeof i==\"string\"?t.push(Ie(r,i)):i instanceof Uint8Array&&t.push(k(r,Array.from(i))))}},Ie=(t,e)=>{let r=fe.encode(e);return k(t,[C(r.length),C(Es(\"und\")),Array.from(r)])},ms={\"image/jpeg\":13,\"image/png\":14,\"image/bmp\":27},_s=(t,e)=>{let r=[];for(let{key:i,value:s}of or(t))switch(i){case\"title\":r.push({key:e?\"title\":\"\\xA9nam\",value:xe(s)});break;case\"description\":r.push({key:e?\"description\":\"\\xA9des\",value:xe(s)});break;case\"artist\":r.push({key:e?\"artist\":\"\\xA9ART\",value:xe(s)});break;case\"album\":r.push({key:e?\"album\":\"\\xA9alb\",value:xe(s)});break;case\"albumArtist\":r.push({key:e?\"album_artist\":\"aART\",value:xe(s)});break;case\"comment\":r.push({key:e?\"comment\":\"\\xA9cmt\",value:xe(s)});break;case\"genre\":r.push({key:e?\"genre\":\"\\xA9gen\",value:xe(s)});break;case\"beatsPerMinute\":e||r.push({key:\"tmpo\",value:k(\"data\",[b(21),b(0),C(s)])});break;case\"lyrics\":r.push({key:e?\"lyrics\":\"\\xA9lyr\",value:xe(s)});break;case\"date\":r.push({key:e?\"date\":\"\\xA9day\",value:xe(s.toISOString().slice(0,10))});break;case\"images\":for(let o of s)o.kind===\"coverFront\"&&r.push({key:\"covr\",value:k(\"data\",[b(ms[o.mimeType]??0),b(0),Array.from(o.data)])});break;case\"trackNumber\":if(e){let o=t.tracksTotal!==void 0?`${s}/${t.tracksTotal}`:s.toString();r.push({key:\"track\",value:xe(o)})}else r.push({key:\"trkn\",value:k(\"data\",[b(0),b(0),C(0),C(s),C(t.tracksTotal??0),C(0)])});break;case\"discNumber\":e||r.push({key:\"disc\",value:k(\"data\",[b(0),b(0),C(0),C(s),C(t.discsTotal??0),C(0)])});break;case\"tracksTotal\":case\"discsTotal\":break;case\"raw\":break;default:Pe(i)}if(t.raw)for(let i in t.raw){let s=t.raw[i];s==null||!e&&i.length!==4||r.some(o=>o.key===i)||(typeof s==\"string\"?r.push({key:i,value:xe(s)}):s instanceof Uint8Array?r.push({key:i,value:k(\"data\",[b(0),b(0),Array.from(s)])}):s instanceof ye&&r.push({key:i,value:k(\"data\",[b(ms[s.mimeType]??0),b(0),Array.from(s.data)])}))}return r},Ia=t=>{let e=_s(t,!1);return e.length===0?null:O(\"meta\",0,0,void 0,[Ei(!1,\"mdir\",\"\",\"appl\"),k(\"ilst\",void 0,e.map(r=>k(r.key,void 0,[r.value])))])},va=t=>{let e=_s(t,!0);return e.length===0?null:k(\"meta\",void 0,[Ei(!1,\"mdta\",\"\"),O(\"keys\",0,0,[b(e.length)],e.map(r=>k(\"mdta\",[...fe.encode(r.key)]))),k(\"ilst\",void 0,e.map((r,i)=>{let s=String.fromCharCode(...b(i+1));return k(s,void 0,[r.value])}))])},xe=t=>k(\"data\",[b(1),b(0),...fe.encode(t)]),Ba=(t,e)=>{switch(t){case\"avc\":return e.startsWith(\"avc3\")?\"avc3\":\"avc1\";case\"hevc\":return\"hvc1\";case\"vp8\":return\"vp08\";case\"vp9\":return\"vp09\";case\"av1\":return\"av01\";case\"prores\":return e}},Pa={avc:Zo,hevc:Yo,vp8:hs,vp9:hs,av1:Jo,prores:null},Cs=(t,e,r)=>{switch(t){case\"aac\":return\"mp4a\";case\"mp3\":return\"mp4a\";case\"opus\":return\"Opus\";case\"vorbis\":return\"mp4a\";case\"flac\":return\"fLaC\";case\"ulaw\":return\"ulaw\";case\"alaw\":return\"alaw\";case\"pcm-u8\":return\"raw \";case\"pcm-s8\":return\"sowt\";case\"ac3\":return\"ac-3\";case\"eac3\":return\"ec-3\";case\"dts\":return e}if(r)switch(t){case\"pcm-s16\":return\"sowt\";case\"pcm-s16be\":return\"twos\";case\"pcm-s24\":return\"in24\";case\"pcm-s24be\":return\"in24\";case\"pcm-s32\":return\"in32\";case\"pcm-s32be\":return\"in32\";case\"pcm-f32\":return\"fl32\";case\"pcm-f32be\":return\"fl32\";case\"pcm-f64\":return\"fl64\";case\"pcm-f64be\":return\"fl64\"}else switch(t){case\"pcm-s16\":return\"ipcm\";case\"pcm-s16be\":return\"ipcm\";case\"pcm-s24\":return\"ipcm\";case\"pcm-s24be\":return\"ipcm\";case\"pcm-s32\":return\"ipcm\";case\"pcm-s32be\":return\"ipcm\";case\"pcm-f32\":return\"fpcm\";case\"pcm-f32be\":return\"fpcm\";case\"pcm-f64\":return\"fpcm\";case\"pcm-f64be\":return\"fpcm\"}},Ra=(t,e)=>{switch(t){case\"aac\":return Si;case\"mp3\":return Si;case\"opus\":return ia;case\"vorbis\":return Si;case\"flac\":return na;case\"ac3\":return sa;case\"eac3\":return oa;case\"dts\":return aa}if(e)switch(t){case\"pcm-s24\":return Ye;case\"pcm-s24be\":return Ye;case\"pcm-s32\":return Ye;case\"pcm-s32be\":return Ye;case\"pcm-f32\":return Ye;case\"pcm-f32be\":return Ye;case\"pcm-f64\":return Ye;case\"pcm-f64be\":return Ye}else switch(t){case\"pcm-s16\":return Ee;case\"pcm-s16be\":return Ee;case\"pcm-s24\":return Ee;case\"pcm-s24be\":return Ee;case\"pcm-s32\":return Ee;case\"pcm-s32be\":return Ee;case\"pcm-f32\":return Ee;case\"pcm-f32be\":return Ee;case\"pcm-f64\":return Ee;case\"pcm-f64be\":return Ee}return null},Fa={webvtt:\"wvtt\"},Ma={webvtt:la},Es=t=>{p(t.length===3);let e=0;for(let r=0;r<3;r++)e<<=5,e+=t.charCodeAt(r)-96;return e};var dt=class{constructor(e,r){if(this.finalized=!1,this.started=!1,this.pos=0,this.trackedWrites=null,this.trackedStart=-1,this.trackedEnd=-1,e._writerAcquired)throw new Error(\"Can't have multiple Writers for the same Target.\");this.target=e,e._setMonotonicity(r),e._writerAcquired=!0}start(){p(!this.started),this.target._start(),this.started=!0}write(e){p(this.started&&!this.finalized),this.maybeTrackWrites(e),this.target._write(e,this.pos),this.pos+=e.byteLength}seek(e){this.pos=e}getPos(){return this.pos}async flush(){return p(this.started&&!this.finalized),this.target._flush()}async finalize(){p(this.started&&!this.finalized),await this.target._finalize(),this.finalized=!0}maybeTrackWrites(e){if(!this.trackedWrites)return;let r=this.getPos();if(r<this.trackedStart){if(r+e.byteLength<=this.trackedStart)return;e=e.subarray(this.trackedStart-r),r=0}let i=r+e.byteLength-this.trackedStart,s=this.trackedWrites.byteLength;for(;s<i;)s*=2;if(s!==this.trackedWrites.byteLength){let o=new Uint8Array(s);o.set(this.trackedWrites,0),this.trackedWrites=o}this.trackedWrites.set(e,r-this.trackedStart),this.trackedEnd=Math.max(this.trackedEnd,r+e.byteLength)}startTrackingWrites(){this.trackedWrites=new Uint8Array(2**10),this.trackedStart=this.getPos(),this.trackedEnd=this.trackedStart}stopTrackingWrites(){if(!this.trackedWrites)throw new Error(\"Internal error: Can't get tracked writes since nothing was tracked.\");let r={data:this.trackedWrites.subarray(0,this.trackedEnd-this.trackedStart),start:this.trackedStart,end:this.trackedEnd};return this.trackedWrites=null,r}};var ce=class extends de{constructor(){super(...arguments),this._writerAcquired=!1,this._monotonicity=null,this.onwrite=null}_setMonotonicity(e){this._monotonicity!==!1&&(this._monotonicity=e)}_dispatchWrite(e,r){this.onwrite?.(e,r),this._emit(\"write\",{start:e,end:r})}slice(e){if(!Number.isInteger(e)||e<0)throw new TypeError(\"offset must be a non-negative integer.\");return new zr(this,e)}},Bi=2**16,Pi=2**32,Ve=class extends ce{constructor(e={}){if(super(),this.buffer=null,this._maxPos=0,!e||typeof e!=\"object\")throw new TypeError(\"BufferTarget options, when provided, must be an object.\");if(e.onFinalize!==void 0&&typeof e.onFinalize!=\"function\")throw new TypeError(\"options.onFinalize, when provided, must be a function.\");if(this._options=e,this._supportsResize=\"resize\"in new ArrayBuffer(0),this._supportsResize)try{this._buffer=new ArrayBuffer(Bi,{maxByteLength:Pi})}catch{this._buffer=new ArrayBuffer(Bi),this._supportsResize=!1}else this._buffer=new ArrayBuffer(Bi);this._bytes=new Uint8Array(this._buffer)}_ensureSize(e){let r=this._buffer.byteLength;for(;r<e;)r*=2;if(r!==this._buffer.byteLength){if(r>Pi)throw new Error(`ArrayBuffer exceeded maximum size of ${Pi} bytes. Please consider using another target.`);if(this._supportsResize)this._buffer.resize(r);else{let i=new ArrayBuffer(r),s=new Uint8Array(i);s.set(this._bytes,0),this._buffer=i,this._bytes=s}}}_start(){}_write(e,r){this._ensureSize(r+e.byteLength),this._bytes.set(e,r),this._maxPos=Math.max(this._maxPos,r+e.byteLength),this._dispatchWrite(r,r+e.byteLength)}async _flush(){}async _finalize(){this.buffer=this._buffer.slice(0,this._maxPos),this._options.onFinalize&&await this._options.onFinalize(this.buffer),this._emit(\"finalized\")}async _close(){}_getSlice(e,r){return this._bytes.slice(e,r)}},Kl=2**24;var zr=class extends ce{constructor(e,r){super(),this._baseTarget=e,this._offset=r}_start(){}_write(e,r){this._baseTarget._write(e,this._offset+r),this._dispatchWrite(r,r+e.byteLength)}_flush(){return this._baseTarget._flush()}async _finalize(){this._emit(\"finalized\")}async _close(){}_setMonotonicity(e){super._setMonotonicity(e),this._baseTarget._setMonotonicity(e)}},ft=class{constructor(e,r){if(this.rootPath=e,this.getTarget=r,typeof e!=\"string\")throw new TypeError(\"rootPath must be a string.\");if(typeof r!=\"function\")throw new TypeError(\"getTarget must be a function.\")}};var oe=57600,Oa=2082844800,Is=t=>{let e={},r=t.track;return r.metadata.name!==void 0&&(e.name=r.metadata.name),e},W=(t,e,r=!0)=>{let i=t*e;return r?Math.round(i):i},ut=t=>{if(t.samples.length===0)return 0;let e=1/0,r=-1/0;for(let i=0;i<t.samples.length;i++){let s=t.samples[i];s.timestamp<e&&(e=s.timestamp),s.timestamp+s.duration>r&&(r=s.timestamp+s.duration)}return e===1/0?0:r-e},Dr=class extends Or{constructor(e,r){super(e),this.writer=null,this.boxWriter=null,this.initWriter=null,this.initBoxWriter=null,this.auxTarget=new Ve,this.auxWriter=new dt(this.auxTarget,!1),this.auxBoxWriter=new lt(this.auxWriter),this.mdat=null,this.ftypSize=null,this.trackDatas=[],this.allTracksKnown=Ke(),this.creationTime=Math.floor(Date.now()/1e3)+Oa,this.finalizedChunks=[],this.wroteFragmentedHeader=!1,this.nextFragmentNumber=1,this.maxWrittenTimestamp=-1/0,this.minWrittenTimestamp=1/0,this.maxWrittenEndTimestamp=-1/0,this.segmentHeaderSize=null,this.format=r,this.formatOptions={...r._options},this.isQuickTime=r instanceof Mt,this.isCmaf=r instanceof Ft,this.minimumFragmentDuration=this.formatOptions.minimumFragmentDuration??(r instanceof Ft?1/0:1),this.auxWriter.start()}async start(){let e=await this.mutex.acquire();if(this.isCmaf?(this.fastStart=\"fragmented\",this.isFragmented=!0):(this.writer=await this.output._getRootWriter(i=>this.formatOptions.fastStart!==void 0?this.formatOptions.fastStart===\"fragmented\":i instanceof Ve),this.boxWriter=new lt(this.writer),this.fastStart=this.formatOptions.fastStart??(this.writer.target instanceof Ve?\"in-memory\":!1),this.isFragmented=this.fastStart===\"fragmented\"),this.isCmaf){if(!this.output._hasInitTarget())throw new Error(\"CMAF outputs require the initTarget field in OutputOptions to be set; the init segment will be written to it.\");let i=await this.output._getInitTarget(),s=new dt(i,!0);s.start(),this.initWriter=s,this.initBoxWriter=new lt(s)}let r=this.output.tracks.some(i=>i.isVideoTrack()&&i.source._codec===\"avc\");{let i=this.initBoxWriter??this.boxWriter;if(p(i),this.formatOptions.onFtyp&&i.writer.startTrackingWrites(),i.writeBox(ws({isQuickTime:this.isQuickTime,holdsAvc:r,fragmented:this.isFragmented,cmaf:this.isCmaf})),this.formatOptions.onFtyp){let{data:s,start:o}=i.writer.stopTrackingWrites();this.formatOptions.onFtyp(s,o)}this.ftypSize=i.writer.getPos(),this.isCmaf&&await this.initWriter.flush()}if(this.fastStart!==\"in-memory\")if(this.fastStart===\"reserve\"){for(let i of this.output.tracks)if(i.metadata.maximumPacketCount===void 0)throw new Error(\"All tracks must specify maximumPacketCount in their metadata when using fastStart: 'reserve'.\")}else this.isFragmented||(p(this.writer),p(this.boxWriter),this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat=Yt(!0),this.boxWriter.writeBox(this.mdat));await this.writer?.flush();for(let i of this.output.tracks)i.isVideoTrack()&&i.metadata.decoderConfig?this.getVideoTrackData(i,i.metadata.primingPacket??null,{decoderConfig:i.metadata.decoderConfig}):i.isAudioTrack()&&i.metadata.decoderConfig&&this.getAudioTrackData(i,i.metadata.primingPacket??null,{decoderConfig:i.metadata.decoderConfig});e()}allTracksAreKnown(){for(let e of this.output.tracks)if(!e.source._closed&&!this.trackDatas.some(r=>r.track===e))return!1;return!0}async getMimeType(){await this.allTracksKnown.promise;let e=this.trackDatas.map(r=>r.type===\"video\"||r.type===\"audio\"?r.info.decoderConfig.codec:{webvtt:\"wvtt\"}[r.track.source._codec]);return xr({isQuickTime:this.isQuickTime,hasVideo:this.trackDatas.some(r=>r.type===\"video\"),hasAudio:this.trackDatas.some(r=>r.type===\"audio\"),codecStrings:e})}getVideoTrackData(e,r,i){let s=this.trackDatas.find(h=>h.track===e);if(s)return s;wr(i,e.source._codec),p(i),p(i.decoderConfig);let o={...i.decoderConfig};p(o.codedWidth!==void 0),p(o.codedHeight!==void 0);let n=!1;if(e.source._codec===\"avc\"&&!o.description){if(!r)throw new Error(\"No AVC description provided; you must therefore provide a priming packet.\");let h=mr(r.data);if(!h)throw new Error(\"Couldn't extract an AVCDecoderConfigurationRecord from the AVC packet. Make sure the packets are in Annex B format (as specified in ITU-T-REC-H.264) when not providing a description, or provide a description (must be an AVCDecoderConfigurationRecord as specified in ISO 14496-15) and ensure the packets are in AVCC format.\");o.description=dn(h),n=!0}else if(e.source._codec===\"hevc\"&&!o.description){if(!r)throw new Error(\"No HEVC description provided; you must therefore provide a priming packet.\");let h=pr(r.data);if(!h)throw new Error(\"Couldn't extract an HEVCDecoderConfigurationRecord from the HEVC packet. Make sure the packets are in Annex B format (as specified in ITU-T-REC-H.265) when not providing a description, or provide a description (must be an HEVCDecoderConfigurationRecord as specified in ISO 14496-15) and ensure the packets are in HEVC format.\");o.description=mn(h),n=!0}let a=ji(1/(e.metadata.frameRate??oe),1e6).den,c=o.displayAspectWidth,l=o.displayAspectHeight,u=c===void 0||l===void 0?{num:1,den:1}:yt({num:c*o.codedHeight,den:l*o.codedWidth}),d=o.codec===\"ap4h\"||o.codec===\"ap4x\",f={muxer:this,track:e,type:\"video\",info:{width:o.codedWidth,height:o.codedHeight,pixelAspectRatio:u,decoderConfig:o,requiresAnnexBTransformation:n,hasAlphaChannel:d},timescale:a,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1,avgBitrate:e.source._nominalBitrate??e.metadata.averageBitrate??0,maxBitrate:e.source._nominalBitrate??e.metadata.bitrate??0};return this.trackDatas.push(f),this.trackDatas.sort((h,m)=>h.track.id-m.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),f}getAudioTrackData(e,r,i){let s=this.trackDatas.find(c=>c.track===e);if(s)return s;Ar(i,e.source._codec),p(i),p(i.decoderConfig);let o={...i.decoderConfig},n=!1;if(e.source._codec===\"aac\"&&!o.description){if(!r)throw new Error(\"No AAC description provided; you must therefore provide a priming packet.\");let c=hi(Ue.tempFromBytes(r.data));if(!c)throw new Error(\"Couldn't parse ADTS header from the AAC packet. Make sure the packets are in ADTS format (as specified in ISO 13818-7) when not providing a description, or provide a description (must be an AudioSpecificConfig as specified in ISO 14496-3) and ensure the packets are raw AAC data.\");let l=jt[c.samplingFrequencyIndex],u=lr[c.channelConfiguration];if(l===void 0||u===void 0)throw new Error(\"Invalid ADTS frame header.\");o.description=rn({objectType:c.objectType,outputSampleRate:l,outputNumberOfChannels:u}),n=!0}if(!r){if(e.source._codec===\"ac3\"||e.source._codec===\"eac3\")throw new Error(\"AC-3/E-AC-3 require a priming packet.\");if(e.source._codec===\"dts\")throw new Error(\"DTS requires a priming packet.\")}let a={muxer:this,track:e,type:\"audio\",info:{numberOfChannels:i.decoderConfig.numberOfChannels,sampleRate:i.decoderConfig.sampleRate,decoderConfig:o,requiresPcmTransformation:!this.isFragmented&&ie.includes(e.source._codec),expectedNextPcmPacketTimestamp:null,requiresAdtsStripping:n,primingPacket:r},timescale:o.sampleRate,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1,avgBitrate:e.source._nominalBitrate??e.metadata.averageBitrate??0,maxBitrate:e.source._nominalBitrate??e.metadata.bitrate??0};return this.trackDatas.push(a),this.trackDatas.sort((c,l)=>c.track.id-l.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),a}getSubtitleTrackData(e,r){let i=this.trackDatas.find(o=>o.track===e);if(i)return i;Wn(r),p(r),p(r.config);let s={muxer:this,track:e,type:\"subtitle\",info:{config:r.config},timescale:1e3,samples:[],sampleQueue:[],timestampProcessingQueue:[],timeToSampleTable:[],compositionTimeOffsetTable:[],lastTimescaleUnits:null,lastSample:null,startTimestampOffset:null,finalizedChunks:[],currentChunk:null,compactlyCodedChunkTable:[],closed:!1,avgBitrate:e.source._nominalBitrate??e.metadata.averageBitrate??0,maxBitrate:e.source._nominalBitrate??e.metadata.bitrate??0,lastCueEndTimestamp:null,cueQueue:[],nextSourceId:0,cueToSourceId:new WeakMap};return this.trackDatas.push(s),this.trackDatas.sort((o,n)=>o.track.id-n.track.id),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),s}async addEncodedVideoPacket(e,r,i){let s=await this.mutex.acquire();try{let o=this.getVideoTrackData(e,r,i),n=r.data;if(o.info.requiresAnnexBTransformation){let c=[...wt(n)].map(l=>n.subarray(l.offset,l.offset+l.length));if(c.length===0)throw new Error(\"Failed to transform packet data. Make sure all packets are provided in Annex B format, as specified in ITU-T-REC-H.264 and ITU-T-REC-H.265.\");n=un(c,4)}this.validateTimestamp(o.track,r.timestamp,r.type===\"key\");let a=this.createSampleForTrack(o,n,r.timestamp,r.duration,r.type);await this.registerSample(o,a)}finally{s()}}async addEncodedAudioPacket(e,r,i){let s=await this.mutex.acquire();try{let o=this.getAudioTrackData(e,r,i),n=r.data;if(o.info.requiresAdtsStripping){let u=hi(Ue.tempFromBytes(n));if(!u)throw new Error(\"Expected ADTS frame, didn't get one.\");let d=u.crcCheck===null?is:ns;n=n.subarray(d)}this.validateTimestamp(o.track,r.timestamp,r.type===\"key\");let a=r.timestamp,c=r.duration;if(o.info.requiresPcmTransformation){let d=we(o.info.decoderConfig.codec).sampleSize*o.info.numberOfChannels;if(c=n.byteLength/d/o.info.sampleRate,o.info.expectedNextPcmPacketTimestamp!==null){let f=a-o.info.expectedNextPcmPacketTimestamp;if(f<.01)a=o.info.expectedNextPcmPacketTimestamp;else{let h=await this.padWithSilence(o,o.info.expectedNextPcmPacketTimestamp,f);a=o.info.expectedNextPcmPacketTimestamp+h}}o.info.expectedNextPcmPacketTimestamp=a+c}let l=this.createSampleForTrack(o,n,a,c,r.type);await this.registerSample(o,l)}finally{s()}}async padWithSilence(e,r,i){let s=W(i,e.timescale);if(i=s/e.timescale,s>0){let{sampleSize:o,silentValue:n}=we(e.info.decoderConfig.codec),a=s*e.info.numberOfChannels,c=new Uint8Array(o*a).fill(n),l=this.createSampleForTrack(e,new Uint8Array(c.buffer),r,i,\"key\");await this.registerSample(e,l)}return i}async addSubtitleCue(e,r,i){let s=await this.mutex.acquire();try{let o=this.getSubtitleTrackData(e,i);this.validateTimestamp(o.track,r.timestamp,!0),e.source._codec===\"webvtt\"&&(o.cueQueue.push(r),await this.processWebVTTCues(o,r.timestamp))}finally{s()}}async processWebVTTCues(e,r){for(;e.cueQueue.length>0;){e.lastCueEndTimestamp??=Math.min(0,e.cueQueue[0].timestamp);let i=new Set([]);for(let l of e.cueQueue)p(l.timestamp<=r),p(e.lastCueEndTimestamp<=l.timestamp+l.duration),i.add(Math.max(l.timestamp,e.lastCueEndTimestamp)),i.add(l.timestamp+l.duration);let s=[...i].sort((l,u)=>l-u),o=s[0],n=s[1]??o;if(r<n)break;if(e.lastCueEndTimestamp<o){this.auxWriter.seek(0);let l=Ts();this.auxBoxWriter.writeBox(l);let u=this.auxTarget._getSlice(0,this.auxWriter.getPos()),d=this.createSampleForTrack(e,u,e.lastCueEndTimestamp,o-e.lastCueEndTimestamp,\"key\");await this.registerSample(e,d),e.lastCueEndTimestamp=o}this.auxWriter.seek(0);for(let l=0;l<e.cueQueue.length;l++){let u=e.cueQueue[l];if(u.timestamp>=n)break;bi.lastIndex=0;let d=bi.test(u.text),f=u.timestamp+u.duration,h=e.cueToSourceId.get(u);if(h===void 0&&n<f&&(h=e.nextSourceId++,e.cueToSourceId.set(u,h)),u.notes){let g=ks(u.notes);this.auxBoxWriter.writeBox(g)}let m=Ss(u.text,d?o:null,u.identifier??null,u.settings??null,h??null);this.auxBoxWriter.writeBox(m),f===n&&e.cueQueue.splice(l--,1)}let a=this.auxTarget._getSlice(0,this.auxWriter.getPos()),c=this.createSampleForTrack(e,a,o,n-o,\"key\");await this.registerSample(e,c),e.lastCueEndTimestamp=n}}createSampleForTrack(e,r,i,s,o){return{timestamp:i,decodeTimestamp:i,duration:s,data:r,size:r.byteLength,type:o,timescaleUnitsToNextSample:W(s,e.timescale)}}processTimestamps(e,r){if(e.timestampProcessingQueue.length===0)return;if(e.type===\"audio\"&&e.info.requiresPcmTransformation){p(!this.isFragmented),e.startTimestampOffset??=e.timestampProcessingQueue[0].timestamp;let s=0;for(let o=0;o<e.timestampProcessingQueue.length;o++){let n=e.timestampProcessingQueue[o],a=W(n.duration,e.timescale);s+=a}if(e.timeToSampleTable.length===0)e.timeToSampleTable.push({sampleCount:s,sampleDelta:1});else{let o=Z(e.timeToSampleTable);o.sampleCount+=s}e.timestampProcessingQueue.length=0;return}let i=e.timestampProcessingQueue.map(s=>s.timestamp).sort((s,o)=>s-o);this.isFragmented?e.startTimestampOffset??=Math.min(i[0],0):e.startTimestampOffset??=i[0];for(let s=0;s<e.timestampProcessingQueue.length;s++){let o=e.timestampProcessingQueue[s];o.decodeTimestamp=i[s];let n=W(o.timestamp-o.decodeTimestamp,e.timescale),a=W(o.duration,e.timescale);if(e.lastTimescaleUnits!==null){p(e.lastSample);let c=W(o.decodeTimestamp,e.timescale,!1),l=Math.round(c-e.lastTimescaleUnits);if(p(l>=0),e.lastTimescaleUnits+=l,e.lastSample.timescaleUnitsToNextSample=l,!this.isFragmented){let u=Z(e.timeToSampleTable);if(p(u),u.sampleCount===1){u.sampleDelta=l;let f=e.timeToSampleTable[e.timeToSampleTable.length-2];f&&f.sampleDelta===l&&(f.sampleCount++,e.timeToSampleTable.pop(),u=f)}else u.sampleDelta!==l&&(u.sampleCount--,e.timeToSampleTable.push(u={sampleCount:1,sampleDelta:l}));u.sampleDelta===a?u.sampleCount++:e.timeToSampleTable.push({sampleCount:1,sampleDelta:a});let d=Z(e.compositionTimeOffsetTable);p(d),d.sampleCompositionTimeOffset===n?d.sampleCount++:e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:n})}}else e.lastTimescaleUnits=W(o.decodeTimestamp,e.timescale,!1),this.isFragmented||(e.timeToSampleTable.push({sampleCount:1,sampleDelta:a}),e.compositionTimeOffsetTable.push({sampleCount:1,sampleCompositionTimeOffset:n}));e.lastSample=o}if(e.timestampProcessingQueue.length=0,p(e.lastSample),p(e.lastTimescaleUnits!==null),r!==void 0&&e.lastSample.timescaleUnitsToNextSample===0){p(r.type===\"key\");let s=W(r.timestamp,e.timescale,!1),o=Math.round(s-e.lastTimescaleUnits);e.lastSample.timescaleUnitsToNextSample=o}}async registerSample(e,r){r.type===\"key\"&&this.processTimestamps(e,r),e.timestampProcessingQueue.push(r),this.isFragmented?(e.sampleQueue.push(r),await this.interleaveSamples()):this.fastStart===\"reserve\"?await this.registerSampleFastStartReserve(e,r):await this.addSampleToTrack(e,r)}async addSampleToTrack(e,r){if(!this.isFragmented&&(e.samples.push(r),this.fastStart===\"reserve\")){let s=e.track.metadata.maximumPacketCount;if(p(s!==void 0),e.samples.length>s)throw new Error(`Track #${e.track.id} has already reached the maximum packet count (${s}). Either add less packets or increase the maximum packet count.`)}let i=!1;if(!e.currentChunk)i=!0;else{e.currentChunk.startTimestamp=Math.min(e.currentChunk.startTimestamp,r.timestamp);let s=r.timestamp-e.currentChunk.startTimestamp;if(this.isFragmented){let o=this.trackDatas.every(n=>{if(e===n)return r.type===\"key\";let a=n.sampleQueue[0];return a?a.type===\"key\":n.closed});s>=this.minimumFragmentDuration&&o&&r.timestamp>this.maxWrittenTimestamp&&(i=!0,await this.finalizeFragment())}else i=s>=.5}i&&(e.currentChunk&&await this.finalizeCurrentChunk(e),e.currentChunk={startTimestamp:r.timestamp,samples:[],offset:null,moofOffset:null,trafIndex:null}),p(e.currentChunk),e.currentChunk.samples.push(r),this.isFragmented&&(this.maxWrittenTimestamp=Math.max(this.maxWrittenTimestamp,r.timestamp),this.maxWrittenEndTimestamp=Math.max(this.maxWrittenEndTimestamp,r.timestamp+r.duration),this.minWrittenTimestamp=Math.min(this.minWrittenTimestamp,r.timestamp))}async finalizeCurrentChunk(e){if(p(!this.isFragmented),p(this.writer),!e.currentChunk)return;e.finalizedChunks.push(e.currentChunk),this.finalizedChunks.push(e.currentChunk);let r=e.currentChunk.samples.length;if(e.type===\"audio\"&&e.info.requiresPcmTransformation&&(r=e.currentChunk.samples.reduce((i,s)=>i+W(s.duration,e.timescale),0)),(e.compactlyCodedChunkTable.length===0||Z(e.compactlyCodedChunkTable).samplesPerChunk!==r)&&e.compactlyCodedChunkTable.push({firstChunk:e.finalizedChunks.length,samplesPerChunk:r}),this.fastStart===\"in-memory\"){e.currentChunk.offset=0;return}e.currentChunk.offset=this.writer.getPos();for(let i of e.currentChunk.samples)p(i.data),this.writer.write(i.data),i.data=null;await this.writer.flush()}async interleaveSamples(e=!1){if(p(this.isFragmented),!(!e&&!this.allTracksAreKnown()))e:for(;;){let r=null,i=1/0;for(let o of this.trackDatas){if(!e&&o.sampleQueue.length===0&&!o.closed)break e;o.sampleQueue.length>0&&o.sampleQueue[0].timestamp<i&&(r=o,i=o.sampleQueue[0].timestamp)}if(!r)break;let s=r.sampleQueue.shift();await this.addSampleToTrack(r,s)}}async finalizeFragment(e=!this.isCmaf){if(p(this.isFragmented),!this.wroteFragmentedHeader){this.wroteFragmentedHeader=!0;let h=this.initBoxWriter??this.boxWriter;p(h),this.formatOptions.onMoov&&h.writer.startTrackingWrites(),this.ensureOneEnabledTrack();let m=Rt(this);if(h.writeBox(m),this.formatOptions.onMoov){let{data:g,start:y}=h.writer.stopTrackingWrites();this.formatOptions.onMoov(g,y)}if(this.isCmaf){p(this.initWriter),await this.initWriter.flush(),await this.initWriter.finalize(),this.writer=await this.output._getRootWriter(!0),this.boxWriter=new lt(this.writer);let g=this.boxWriter.measureBox(_i()),y=this.boxWriter.measureBox(Ci(this,0));this.segmentHeaderSize=g+y,this.writer.seek(this.segmentHeaderSize)}}p(this.writer),p(this.boxWriter);let r=this.trackDatas.filter(h=>h.currentChunk);if(r.length===0){e&&await this.writer.flush();return}let i=this.nextFragmentNumber++,s=vi(i,r),o=this.writer.getPos(),n=o+this.boxWriter.measureBox(s),a=n+Ae,c=1/0;for(let h=0;h<r.length;h++){let m=r[h];p(m.currentChunk),p(m.startTimestampOffset!==null),m.currentChunk.offset=a,m.currentChunk.moofOffset=o,m.currentChunk.trafIndex=h,m.currentChunk.startTimestamp-=m.startTimestampOffset;for(let g of m.currentChunk.samples)a+=g.size,g.timestamp-=m.startTimestampOffset,g.decodeTimestamp-=m.startTimestampOffset;c=Math.min(c,m.currentChunk.startTimestamp)}let l=a-n,u=l>=2**32;if(u)for(let h of r)h.currentChunk.offset+=Fe-Ae;this.formatOptions.onMoof&&this.writer.startTrackingWrites();let d=vi(i,r);if(this.boxWriter.writeBox(d),this.formatOptions.onMoof){let{data:h,start:m}=this.writer.stopTrackingWrites();this.formatOptions.onMoof(h,m,c)}p(this.writer.getPos()===n),this.formatOptions.onMdat&&this.writer.startTrackingWrites();let f=Yt(u);f.size=l,this.boxWriter.writeBox(f),this.writer.seek(n+(u?Fe:Ae));for(let h of r)for(let m of h.currentChunk.samples)this.writer.write(m.data),m.data=null;if(this.formatOptions.onMdat){let{data:h,start:m}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(h,m)}for(let h of r)h.finalizedChunks.push(h.currentChunk),this.finalizedChunks.push(h.currentChunk),h.currentChunk=null;e&&await this.writer.flush()}async registerSampleFastStartReserve(e,r){this.allTracksAreKnown()?(this.mdat||await this.createFastStartReserveMdat(),await this.addSampleToTrack(e,r)):e.sampleQueue.push(r)}async createFastStartReserveMdat(){p(this.writer),p(this.boxWriter),this.ensureOneEnabledTrack();let e=Rt(this),i=this.boxWriter.measureBox(e)+this.computeSampleTableSizeUpperBound()+4096;p(this.ftypSize!==null),this.writer.seek(this.ftypSize+i),this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat=Yt(!0),this.boxWriter.writeBox(this.mdat);for(let s of this.trackDatas){for(let o of s.sampleQueue)await this.addSampleToTrack(s,o);s.sampleQueue.length=0}}computeSampleTableSizeUpperBound(){p(this.fastStart===\"reserve\");let e=0;for(let r of this.trackDatas){let i=r.track.metadata.maximumPacketCount;p(i!==void 0),e+=8*Math.ceil(2/3*i),e+=4*i,e+=8*Math.ceil(2/3*i),e+=12*Math.ceil(2/3*i),e+=4*i,e+=8*i}return e}async onTrackClose(e){let r=await this.mutex.acquire(),i=this.trackDatas.find(s=>s.track===e);i&&(i.closed=!0,i.type===\"subtitle\"&&e.source._codec===\"webvtt\"&&await this.processWebVTTCues(i,1/0),this.processTimestamps(i)),this.allTracksAreKnown()&&this.allTracksKnown.resolve(),this.isFragmented&&await this.interleaveSamples(),r()}ensureOneEnabledTrack(){for(let e of[\"video\",\"audio\",\"subtitle\"]){let r=this.trackDatas.filter(s=>s.type===e);if(r.length===0)continue;if(!r.some(s=>s.track.metadata.disposition?.default!==!1)){let s=r[0];s.track.metadata.disposition={...s.track.metadata.disposition,default:!0}}}}async forceFragmentFinalization(){p(this.isFragmented);let e=await this.mutex.acquire();try{for(let r of this.trackDatas)r.type===\"subtitle\"&&r.track.source._codec===\"webvtt\"&&await this.processWebVTTCues(r,1/0),this.processTimestamps(r);await this.interleaveSamples(!0),await this.finalizeFragment()}finally{e()}}async finalize(){let e=await this.mutex.acquire();this.allTracksKnown.resolve(),this.ensureOneEnabledTrack(),!this.mdat&&this.fastStart===\"reserve\"&&await this.createFastStartReserveMdat();for(let r of this.trackDatas)r.closed=!0,r.type===\"subtitle\"&&r.track.source._codec===\"webvtt\"&&await this.processWebVTTCues(r,1/0),this.processTimestamps(r);if(this.isFragmented)await this.interleaveSamples(!0),await this.finalizeFragment(!1);else for(let r of this.trackDatas){await this.finalizeCurrentChunk(r);let i=ut(r);if(i>0){let a=0;for(let c of r.samples)a+=c.size;r.avgBitrate=Math.round(8*a/i)}else r.avgBitrate=0;let s=0,o=0,n=0;for(let a=0;a<r.samples.length;a++){let c=r.samples[a];for(o+=c.size;c.decodeTimestamp-r.samples[s].decodeTimestamp>=1;)o-=r.samples[s].size,s++;n=Math.max(n,o)}if(r.maxBitrate=8*n,r.startTimestampOffset!==null)for(let a=0;a<r.samples.length;a++){let c=r.samples[a];c.timestamp-=r.startTimestampOffset,c.decodeTimestamp-=r.startTimestampOffset}}if(p(this.writer),p(this.boxWriter),this.fastStart===\"in-memory\"){this.mdat=Yt(!1);let r;for(let s=0;s<2;s++){let o=Rt(this),n=this.boxWriter.measureBox(o);r=this.boxWriter.measureBox(this.mdat);let a=this.writer.getPos()+n+r;for(let c of this.finalizedChunks){c.offset=a;for(let{data:l}of c.samples)p(l),a+=l.byteLength,r+=l.byteLength}if(a<2**32)break;r>=2**32&&(this.mdat.largeSize=!0)}this.formatOptions.onMoov&&this.writer.startTrackingWrites();let i=Rt(this);if(this.boxWriter.writeBox(i),this.formatOptions.onMoov){let{data:s,start:o}=this.writer.stopTrackingWrites();this.formatOptions.onMoov(s,o)}this.formatOptions.onMdat&&this.writer.startTrackingWrites(),this.mdat.size=r,this.boxWriter.writeBox(this.mdat);for(let s of this.finalizedChunks)for(let o of s.samples)p(o.data),this.writer.write(o.data),o.data=null;if(this.formatOptions.onMdat){let{data:s,start:o}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(s,o)}}else if(this.isFragmented)if(this.isCmaf){let r=this.segmentHeaderSize!==null?this.writer.getPos()-this.segmentHeaderSize:0;this.writer.seek(0),this.boxWriter.writeBox(_i()),this.boxWriter.writeBox(Ci(this,r))}else{let r=this.writer.getPos(),i=xs(this.trackDatas);this.boxWriter.writeBox(i);let s=this.writer.getPos()-r;this.writer.seek(this.writer.getPos()-4),this.boxWriter.writeU32(s)}else{p(this.mdat);let r=this.boxWriter.offsets.get(this.mdat);p(r!==void 0);let i=this.writer.getPos()-r;if(this.mdat.size=i,this.mdat.largeSize=i>=2**32,this.boxWriter.patchBox(this.mdat),this.formatOptions.onMdat){let{data:o,start:n}=this.writer.stopTrackingWrites();this.formatOptions.onMdat(o,n)}let s=Rt(this);if(this.fastStart===\"reserve\"){p(this.ftypSize!==null),this.writer.seek(this.ftypSize),this.formatOptions.onMoov&&this.writer.startTrackingWrites(),this.boxWriter.writeBox(s);let o=this.boxWriter.offsets.get(this.mdat)-this.writer.getPos();this.boxWriter.writeBox(As(o))}else this.formatOptions.onMoov&&this.writer.startTrackingWrites(),this.boxWriter.writeBox(s);if(this.formatOptions.onMoov){let{data:o,start:n}=this.writer.stopTrackingWrites();this.formatOptions.onMoov(o,n)}}e()}};var Ot=class{constructor(){this._connectedTrack=null,this._closingPromise=null,this._closed=!1,this._nominalBitrate=null}_ensureValidAdd(){if(!this._connectedTrack)throw new Error(\"Source is not connected to an output track.\");if(this._connectedTrack.output.state===\"canceled\")throw new Error(\"Output has been canceled.\");if(this._connectedTrack.output.state===\"finalizing\"||this._connectedTrack.output.state===\"finalized\")throw new Error(\"Output has been finalized.\");if(this._connectedTrack.output.state===\"pending\")throw new Error(\"Output has not started.\");if(this._closed)throw new Error(\"Source is closed.\")}async _start(){}async _flushAndClose(e){}close(){if(this._closingPromise)return;let e=this._connectedTrack;if(!e)throw new Error(\"Cannot call close without connecting the source to an output track.\");if(e.output.state===\"pending\")throw new Error(\"Cannot call close before output has been started.\");this._closingPromise=(async()=>{await this._flushAndClose(!1),this._closed=!0,!(e.output.state===\"finalizing\"||e.output.state===\"finalized\")&&e.output._muxer.onTrackClose(e)})()}async _flushOrWaitForOngoingClose(e){return this._closingPromise??=(async()=>{await this._flushAndClose(e),this._closed=!0})()}},zt=class extends Ot{constructor(e){if(super(),!$e.includes(e))throw new TypeError(`Invalid video codec '${e}'. Must be one of: ${$e.join(\", \")}.`);this._codec=e}},za=(t,e)=>{if(t.metadata.hasOnlyKeyPackets&&e.type!==\"key\")throw new Error(\"Cannot add non-key packets to a hasOnlyKeyPackets video track.\")},Jt=class extends zt{constructor(e){super(e)}add(e,r){if(!(e instanceof G))throw new TypeError(\"packet must be an EncodedPacket.\");if(e.isMetadataOnly)throw new TypeError(\"Metadata-only packets cannot be added.\");if(r!==void 0&&(!r||typeof r!=\"object\"))throw new TypeError(\"meta, when provided, must be an object.\");return this._ensureValidAdd(),za(this._connectedTrack,e),this._connectedTrack.output._muxer.addEncodedVideoPacket(this._connectedTrack,e,r)}};var Dt=class extends Ot{constructor(e){if(super(),!At.includes(e))throw new TypeError(`Invalid audio codec '${e}'. Must be one of: ${At.join(\", \")}.`);this._codec=e}},er=class extends Dt{constructor(e){super(e)}add(e,r){if(!(e instanceof G))throw new TypeError(\"packet must be an EncodedPacket.\");if(e.isMetadataOnly)throw new TypeError(\"Metadata-only packets cannot be added.\");if(r!==void 0&&(!r||typeof r!=\"object\"))throw new TypeError(\"meta, when provided, must be an object.\");return this._ensureValidAdd(),this._connectedTrack.output._muxer.addEncodedAudioPacket(this._connectedTrack,e,r)}};var tr=class extends Ot{constructor(e){if(super(),!ot.includes(e))throw new TypeError(`Invalid subtitle codec '${e}'. Must be one of: ${ot.join(\", \")}.`);this._codec=e}};var Ut=class{get supportsVideoRotationMetadata(){return this.supportsVideoTransformationMetadata}getSupportedVideoCodecs(){return this.getSupportedCodecs().filter(e=>$e.includes(e))}getSupportedAudioCodecs(){return this.getSupportedCodecs().filter(e=>At.includes(e))}getSupportedSubtitleCodecs(){return this.getSupportedCodecs().filter(e=>ot.includes(e))}_codecUnsupportedHint(e){return\"\"}_isFragmentedIsobmff(){return!1}},Lt=class extends Ut{constructor(e={}){if(!e||typeof e!=\"object\")throw new TypeError(\"options must be an object.\");if(e.fastStart!==void 0&&![!1,\"in-memory\",\"reserve\",\"fragmented\"].includes(e.fastStart))throw new TypeError(\"options.fastStart, when provided, must be false, 'in-memory', 'reserve', or 'fragmented'.\");if(e.minimumFragmentDuration!==void 0&&(!it(e.minimumFragmentDuration)||e.minimumFragmentDuration<0))throw new TypeError(\"options.minimumFragmentDuration, when provided, must be a non-negative number.\");if(e.onFtyp!==void 0&&typeof e.onFtyp!=\"function\")throw new TypeError(\"options.onFtyp, when provided, must be a function.\");if(e.onMoov!==void 0&&typeof e.onMoov!=\"function\")throw new TypeError(\"options.onMoov, when provided, must be a function.\");if(e.onMdat!==void 0&&typeof e.onMdat!=\"function\")throw new TypeError(\"options.onMdat, when provided, must be a function.\");if(e.onMoof!==void 0&&typeof e.onMoof!=\"function\")throw new TypeError(\"options.onMoof, when provided, must be a function.\");if(e.metadataFormat!==void 0&&![\"mdir\",\"mdta\",\"udta\",\"auto\"].includes(e.metadataFormat))throw new TypeError(\"options.metadataFormat, when provided, must be either 'auto', 'mdir', 'mdta', or 'udta'.\");super(),this._options=e}getSupportedTrackCounts(){return{video:{min:0,max:4294967295},audio:{min:0,max:4294967295},subtitle:{min:0,max:4294967295},total:{min:0,max:4294967295}}}get supportsVideoTransformationMetadata(){return!0}get supportsTimestampedMediaData(){return!0}get negativeTimestampSupport(){return\"full\"}_createMuxer(e){return new Dr(e,this)}_isFragmentedIsobmff(){return this._options.fastStart===\"fragmented\"}},Vt=class extends Lt{constructor(e){super(e)}get _name(){return\"MP4\"}get fileExtension(){return\".mp4\"}get mimeType(){return\"video/mp4\"}getSupportedCodecs(){return[...$e,...yr,\"pcm-s16\",\"pcm-s16be\",\"pcm-s24\",\"pcm-s24be\",\"pcm-s32\",\"pcm-s32be\",\"pcm-f32\",\"pcm-f32be\",\"pcm-f64\",\"pcm-f64be\",...ot]}_codecUnsupportedHint(e){return new Mt().getSupportedCodecs().includes(e)?\" Switching to MOV will grant support for this codec.\":\"\"}},Ft=class extends Lt{constructor(e){super(e)}get _name(){return\"CMAF\"}get fileExtension(){return\".m4s\"}get mimeType(){return\"video/mp4\"}getSupportedCodecs(){return[...$e,...yr,\"pcm-s16\",\"pcm-s16be\",\"pcm-s24\",\"pcm-s24be\",\"pcm-s32\",\"pcm-s32be\",\"pcm-f32\",\"pcm-f32be\",\"pcm-f64\",\"pcm-f64be\",...ot]}},Mt=class extends Lt{constructor(e){super(e)}get _name(){return\"MOV\"}get fileExtension(){return\".mov\"}get mimeType(){return\"video/quicktime\"}getSupportedCodecs(){return[...$e,...At]}_codecUnsupportedHint(e){return new Vt().getSupportedCodecs().includes(e)?\" Switching to MP4 will grant support for this codec.\":\"\"}};var vs=[\"video\",\"audio\",\"subtitle\"],Wt=class t{constructor(e,r,i,s,o){this.id=e,this.output=r,this.type=i,this.source=s,this.metadata=o}isVideoTrack(){return this.type===\"video\"}isAudioTrack(){return this.type===\"audio\"}isSubtitleTrack(){return this.type===\"subtitle\"}canBePairedWith(e){if(!(e instanceof t))throw new TypeError(\"other must be an OutputTrack.\");if(this===e)return!1;let r=cr(this.metadata.group),i=cr(e.metadata.group);for(let s of r)if(this.type!==e.type&&i.some(a=>s===a)||i.some(a=>s._pairedGroups.has(a)))return!0;return!1}},Ur=class extends Wt{constructor(e,r,i,s){super(e,r,\"video\",i,s)}},Lr=class extends Wt{constructor(e,r,i,s){super(e,r,\"audio\",i,s)}},Vr=class extends Wt{constructor(e,r,i,s){super(e,r,\"subtitle\",i,s)}},Nt=class t{constructor(){this._pairedGroups=new Set}pairWith(e){if(!(e instanceof t))throw new TypeError(\"other must be an OutputTrackGroup.\");if(this===e)throw new TypeError(\"Cannot pair a group with itself.\");this._pairedGroups.add(e),e._pairedGroups.add(this)}},Ri=t=>{if(!t||typeof t!=\"object\")throw new TypeError(\"metadata must be an object.\");if(t.languageCode!==void 0&&!sr(t.languageCode))throw new TypeError(\"metadata.languageCode, when provided, must be a three-letter, ISO 639-2/T language code.\");if(t.name!==void 0&&typeof t.name!=\"string\")throw new TypeError(\"metadata.name, when provided, must be a string.\");if(t.disposition!==void 0&&Ji(t.disposition),t.maximumPacketCount!==void 0&&(!Number.isInteger(t.maximumPacketCount)||t.maximumPacketCount<0))throw new TypeError(\"metadata.maximumPacketCount, when provided, must be a non-negative integer.\");if(t.bitrate!==void 0&&(!Number.isFinite(t.bitrate)||t.bitrate<0))throw new TypeError(\"metadata.bitrate, when provided, must be a non-negative number.\");if(t.averageBitrate!==void 0&&(!Number.isFinite(t.averageBitrate)||t.averageBitrate<0))throw new TypeError(\"metadata.averageBitrate, when provided, must be a non-negative number.\");if(t.group!==void 0&&!(t.group instanceof Nt)&&(!Array.isArray(t.group)||t.group.some(e=>!(e instanceof Nt))))throw new TypeError(\"metadata.group, when provided, must be an OutputTrackGroup instance or an array of OutputTrackGroup instances.\")},rr=class extends de{get target(){let e=\"Output.target cannot be used when using PathedTarget with an async callback. Use the 'target' event instead.\";if(this._rootTargetPromise)throw new TypeError(e);let r=this._getRootTarget();if(F(r))throw new TypeError(e);return r}constructor(e){if(super(),this.state=\"pending\",this.defaultTrackGroup=new Nt,this.tracks=[],this._onFinalize=null,this._unfinalizedTargets=new Set,this._rootWriterPromise=null,this._startPromise=null,this._cancelPromise=null,this._finalizePromise=null,this._mutex=new mt,this._metadataTags={},this._rootTarget=null,this._rootTargetPromise=null,this._firstMediaStreamTimestamp=null,!e||typeof e!=\"object\")throw new TypeError(\"options must be an object.\");if(!(e.format instanceof Ut))throw new TypeError(\"options.format must be an OutputFormat.\");if(!(e.target instanceof ce||e.target instanceof ft))throw new TypeError(\"options.target must be a Target or a PathedTarget.\");if(e.target instanceof ce&&this._rememberTarget(e.target),e.initTarget!==void 0&&!(e.initTarget instanceof ce)&&typeof e.initTarget!=\"function\")throw new Error(\"options.initTarget, when provided, must be a Target or a function that returns or resolves to a Target.\");if(e.onFinalize!==void 0&&typeof e.onFinalize!=\"function\")throw new TypeError(\"options.onFinalize, when provided, must be a function.\");this.format=e.format,this._target=e.target,this._onFinalize=e.onFinalize??null,this._initTarget=e.initTarget??null,this._initTarget instanceof ce&&this._rememberTarget(this._initTarget),this._muxer=e.format._createMuxer(this)}_getTargetValidated(e){p(this._target instanceof ft);let r=this._target.getTarget(e),i=s=>{if(!(s instanceof ce))throw new TypeError(\"getTarget must return a Target.\");return s};return F(r)?r.then(i):i(r)}async _getTarget(e){p(this._target instanceof ft);let r=await this._getTargetValidated(e);return this._emit(\"target\",{target:r,request:e,isRoot:e.isRoot}),this.state===\"canceled\"?await r._close():this._rememberTarget(r),r}_rememberTarget(e){this._unfinalizedTargets.add(e),e.on(\"finalized\",()=>this._unfinalizedTargets.delete(e),{once:!0})}async _getInitTarget(){if(p(this._initTarget!==null),this._initTarget instanceof ce)return this._initTarget;let e=await this._initTarget();return this.state===\"canceled\"?await e._close():this._rememberTarget(e),e}_hasInitTarget(){return this._initTarget!==null}_getRootTarget(){if(this._rootTarget)return this._rootTarget;if(this._rootTargetPromise)return this._rootTargetPromise;if(this._target instanceof ce)return this._emit(\"target\",{target:this._target,request:null,isRoot:!0}),this._rootTarget=this._target,this._target;let e={path:this._target.rootPath,isRoot:!0,mimeType:this.format.mimeType},r=this._getTargetValidated(e),i=s=>(this.state===\"canceled\"?s._close():this._rememberTarget(s),this._emit(\"target\",{target:s,request:e,isRoot:!0}),this._rootTarget=s,s);return F(r)?this._rootTargetPromise=r.then(i):i(r)}_getRootWriter(e){return this._rootWriterPromise??=(async()=>{let r=await this._getRootTarget(),i=new dt(r,typeof e==\"boolean\"?e:e(r));return i.start(),i})()}addVideoTrack(e,r={}){if(!(e instanceof zt))throw new TypeError(\"source must be a VideoSource.\");if(Ri(r),r.rotation!==void 0&&![0,90,180,270].includes(r.rotation))throw new TypeError(`Invalid video rotation: ${r.rotation}. Has to be 0, 90, 180 or 270.`);if(r.flip!==void 0&&typeof r.flip!=\"boolean\")throw new TypeError(\"metadata.flip, when provided, must be a boolean.\");if(r.transformationMatrix!==void 0&&(!Array.isArray(r.transformationMatrix)||r.transformationMatrix.length!==9||!r.transformationMatrix.every(s=>Number.isFinite(s))))throw new TypeError(\"metadata.transformationMatrix, when provided, must be an array of 9 finite numbers.\");if(r.frameRate!==void 0&&(!Number.isFinite(r.frameRate)||r.frameRate<=0))throw new TypeError(`Invalid video frame rate: ${r.frameRate}. Must be a positive number.`);if(r.decoderConfig!==void 0&&wr({decoderConfig:r.decoderConfig},e._codec),r.primingPacket!==void 0){if(!(r.primingPacket instanceof G))throw new TypeError(\"metadata.primingPacket, when provided, must be an EncodedPacket.\");if(r.decoderConfig===void 0)throw new TypeError(\"metadata.primingPacket can only be provided alongside metadata.decoderConfig.\")}let i={...r};return i.group??=this.defaultTrackGroup,this._addTrack(new Ur(this.tracks.length+1,this,e,i))}addAudioTrack(e,r={}){if(!(e instanceof Dt))throw new TypeError(\"source must be an AudioSource.\");if(Ri(r),r.decoderConfig!==void 0&&Ar({decoderConfig:r.decoderConfig},e._codec),r.primingPacket!==void 0){if(!(r.primingPacket instanceof G))throw new TypeError(\"metadata.primingPacket, when provided, must be an EncodedPacket.\");if(r.decoderConfig===void 0)throw new TypeError(\"metadata.primingPacket can only be provided alongside metadata.decoderConfig.\")}let i={...r};return i.group??=this.defaultTrackGroup,this._addTrack(new Lr(this.tracks.length+1,this,e,i))}addSubtitleTrack(e,r={}){if(!(e instanceof tr))throw new TypeError(\"source must be a SubtitleSource.\");Ri(r);let i={...r};return i.group??=this.defaultTrackGroup,this._addTrack(new Vr(this.tracks.length+1,this,e,i))}setMetadataTags(e){if(Zi(e),this.state!==\"pending\")throw new Error(\"Cannot set metadata tags after output has been started or canceled.\");this._metadataTags=e}_addTrack(e){if(this.state!==\"pending\")throw new Error(\"Cannot add track after output has been started or canceled.\");if(e.source._connectedTrack)throw new Error(\"Source is already used for a track.\");let r=this.format.getSupportedTrackCounts(),i=this.tracks.reduce((n,a)=>n+(a.type===e.type?1:0),0),s=r[e.type].max;if(i===s)throw new Error(s===0?`${this.format._name} does not support ${e.type} tracks.`:`${this.format._name} does not support more than ${s} ${e.type} track${s===1?\"\":\"s\"}.`);let o=r.total.max;if(this.tracks.length===o)throw new Error(`${this.format._name} does not support more than ${o} tracks${o===1?\"\":\"s\"} in total.`);if(e.isVideoTrack()){let n=this.format.getSupportedVideoCodecs();if(n.length===0)throw new Error(`${this.format._name} does not support video tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!n.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported video codecs are: ${n.map(a=>`'${a}'`).join(\", \")}.`+this.format._codecUnsupportedHint(e.source._codec))}else if(e.isAudioTrack()){let n=this.format.getSupportedAudioCodecs();if(n.length===0)throw new Error(`${this.format._name} does not support audio tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!n.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported audio codecs are: ${n.map(a=>`'${a}'`).join(\", \")}.`+this.format._codecUnsupportedHint(e.source._codec))}else if(e.isSubtitleTrack()){let n=this.format.getSupportedSubtitleCodecs();if(n.length===0)throw new Error(`${this.format._name} does not support subtitle tracks.`+this.format._codecUnsupportedHint(e.source._codec));if(!n.includes(e.source._codec))throw new Error(`Codec '${e.source._codec}' cannot be contained within ${this.format._name}. Supported subtitle codecs are: ${n.map(a=>`'${a}'`).join(\", \")}.`+this.format._codecUnsupportedHint(e.source._codec))}return this.tracks.push(e),e.source._connectedTrack=e,e}hasEnoughTracks(){let e=this.format.getSupportedTrackCounts();for(let i of vs){let s=this.tracks.reduce((n,a)=>n+(a.type===i?1:0),0),o=e[i].min;if(s<o)return!1}let r=e.total.min;return!(this.tracks.length<r)}async start(){let e=this.format.getSupportedTrackCounts();for(let i of vs){let s=this.tracks.reduce((n,a)=>n+(a.type===i?1:0),0),o=e[i].min;if(s<o)throw new Error(o===e[i].max?`${this.format._name} requires exactly ${o} ${i} track${o===1?\"\":\"s\"}.`:`${this.format._name} requires at least ${o} ${i} track${o===1?\"\":\"s\"}.`)}let r=e.total.min;if(this.tracks.length<r)throw new Error(r===e.total.max?`${this.format._name} requires exactly ${r} track${r===1?\"\":\"s\"}.`:`${this.format._name} requires at least ${r} track${r===1?\"\":\"s\"}.`);if(this.state===\"canceled\")throw new Error(\"Output has been canceled.\");return this._startPromise?(R._warn(\"Output has already been started.\"),this._startPromise):this._startPromise=(async()=>{this.state=\"started\";let i=this._mutex.acquire();try{await this._muxer.start();let s=this.tracks.map(o=>o.source._start());await Promise.all(s)}finally{(await i)()}})()}getMimeType(){return this._muxer.getMimeType()}async cancel(){if(this.state===\"canceled\")return this._cancelPromise??void 0;if(this.state===\"finalizing\"||this.state===\"finalized\"){this.state===\"finalized\"&&R._warn(\"Output has already been finalized.\");return}return this._cancelPromise=(async()=>{this.state=\"canceled\";let e=await this._mutex.acquire();try{let r=this.tracks.map(i=>i.source._flushOrWaitForOngoingClose(!0));await Promise.all(r),await Promise.all([...this._unfinalizedTargets].map(i=>i._close())),this._unfinalizedTargets.clear()}finally{e()}})()}async finalize(){if(this.state===\"pending\")throw new Error(\"Cannot finalize before starting.\");if(this.state===\"canceled\")throw new Error(\"Cannot finalize after canceling.\");return this._finalizePromise?(R._warn(\"Output has already been finalized.\"),this._finalizePromise):this._finalizePromise=(async()=>{this.state=\"finalizing\";let e=await this._mutex.acquire();try{let r=this.tracks.map(i=>i.source._flushOrWaitForOngoingClose(!1));if(await Promise.all(r),await this._muxer.finalize(),this._rootWriterPromise){let i=await this._rootWriterPromise;i.finalized||(await i.flush(),await i.finalize())}this._onFinalize&&await this._onFinalize(),this.state=\"finalized\"}catch(r){throw this.state=\"canceled\",r}finally{await Promise.all([...this._unfinalizedTargets].map(r=>r._close().catch(()=>{}))),this._unfinalizedTargets.clear(),e()}})()}};var Bs=Symbol.for(\"mediabunny loaded\");globalThis[Bs]&&R._error(`[WARNING]\nMediabunny was loaded twice. This will likely cause Mediabunny not to work correctly. Check if multiple dependencies are importing different versions of Mediabunny, or if something is being bundled incorrectly.`);globalThis[Bs]=!0;function Ps(t,e){self.postMessage({type:\"progress\",track:t,fraction:Math.max(0,Math.min(.99,e))})}async function Rs(t){let e=Number(await t.getDurationFromMetadata());if(Number.isFinite(e)&&e>0)return e;let r=Number(await t.computeDuration());if(!Number.isFinite(r)||r<=0)throw new Error(\"\\u65E0\\u6CD5\\u786E\\u8BA4\\u97F3\\u89C6\\u9891\\u8F68\\u65F6\\u957F\\uFF0C\\u5DF2\\u963B\\u6B62\\u751F\\u6210\\u6587\\u4EF6\");return r}function Da(t,e,r){let i=r>0?r:Math.max(t,e),s=Math.max(3,i*.03);if(r>0&&Math.abs(t-r)>s)throw new Error(`\\u89C6\\u9891\\u8F68\\u65F6\\u957F ${t.toFixed(1)} \\u79D2\\u4E0E\\u5F53\\u524D\\u89C6\\u9891 ${r.toFixed(1)} \\u79D2\\u4E0D\\u7B26\\uFF0C\\u5DF2\\u963B\\u6B62\\u751F\\u6210\\u6587\\u4EF6`);if(r>0&&Math.abs(e-r)>s)throw new Error(`\\u97F3\\u9891\\u8F68\\u65F6\\u957F ${e.toFixed(1)} \\u79D2\\u4E0E\\u5F53\\u524D\\u89C6\\u9891 ${r.toFixed(1)} \\u79D2\\u4E0D\\u7B26\\uFF0C\\u5DF2\\u963B\\u6B62\\u751F\\u6210\\u6587\\u4EF6`);if(Math.abs(t-e)>s)throw new Error(`\\u97F3\\u89C6\\u9891\\u8F68\\u65F6\\u957F\\u4E0D\\u4E00\\u81F4\\uFF08${t.toFixed(1)} / ${e.toFixed(1)} \\u79D2\\uFF09\\uFF0C\\u5DF2\\u963B\\u6B62\\u751F\\u6210\\u6587\\u4EF6`)}async function Fs(t,e,r,i,s){let o=new Xe(t),n=0;for await(let a of o.packets())await e.add(a,n===0&&r?{decoderConfig:r}:void 0),n+=1,(n&63)===0&&Ps(i,s>0?a.timestamp/s:0);if(e.close(),Ps(i,.99),n===0)throw new Error(`\\u6CA1\\u6709\\u8BFB\\u53D6\\u5230${i===\"video\"?\"\\u89C6\\u9891\":\"\\u97F3\\u9891\"}\\u7F16\\u7801\\u5305`);return n}async function Ua(t){let e=new Pt({source:new kt(t.video),formats:[Rr]}),r=new Pt({source:new kt(t.audio),formats:[Rr]}),i;try{let[s,o]=await Promise.all([e.getPrimaryVideoTrack(),r.getPrimaryAudioTrack()]);if(!s||!o)throw new Error(\"\\u65E0\\u6CD5\\u8BC6\\u522B\\u97F3\\u89C6\\u9891\\u8F68\\uFF1B\\u53EF\\u6539\\u7528\\u5206\\u8F68\\u4E0B\\u8F7D\");let[n,a,c,l]=await Promise.all([s.getCodec(),o.getCodec(),s.getDecoderConfig(),o.getDecoderConfig()]);if(!n||!a||!c||!l)throw new Error(\"\\u7F16\\u7801\\u4FE1\\u606F\\u4E0D\\u5B8C\\u6574\\uFF1B\\u53EF\\u6539\\u7528\\u5206\\u8F68\\u4E0B\\u8F7D\");let u=Number(t.duration)||0,[d,f]=await Promise.all([Rs(s),Rs(o)]);Da(d,f,u);let h=new Jt(n),m=new er(a),g=new Ve;i=new rr({format:new Vt({fastStart:\"in-memory\"}),target:g}),i.addVideoTrack(h,{decoderConfig:c}),i.addAudioTrack(m,{decoderConfig:l}),t.title&&i.setMetadataTags({title:t.title}),await i.start();let y=u,[w,A]=await Promise.all([Fs(s,h,c,\"video\",y),Fs(o,m,l,\"audio\",y)]);if(await i.finalize(),!g.buffer)throw new Error(\"MP4 \\u5C01\\u88C5\\u672A\\u751F\\u6210\\u8F93\\u51FA\\u6570\\u636E\");self.postMessage({type:\"done\",buffer:g.buffer,videoPackets:w,audioPackets:A,bytes:g.buffer.byteLength},[g.buffer])}catch(s){if(i&&i.state!==\"finalized\"&&i.state!==\"canceled\")try{await i.cancel()}catch{}self.postMessage({type:\"error\",message:s instanceof Error?s.message.slice(0,240):\"MP4 \\u5C01\\u88C5\\u5931\\u8D25\"})}finally{await Promise.allSettled([e.dispose(),r.dispose()])}}self.addEventListener(\"message\",t=>{t.data?.type===\"remux\"&&Ua(t.data)});})();\n";
  // END GENERATED BILIKIT REMUX WORKER
  let DOWNLOAD_PLAYINFO_CACHE = null;
  let DOWNLOAD_PAGE_ROUTE_KEY = "";
  let DOWNLOAD_PLAYURL_TEMPLATE = null;
  let DOWNLOAD_ACTIVE_FETCH = null;
  let DOWNLOAD_ACTIVE_FETCH_ROUTE_KEY = "";
  let DOWNLOAD_ACTIVE_FETCH_ATTEMPTS = 0;
  let DOWNLOAD_CATALOG_CACHE = null;
  let DOWNLOAD_BATCH_CONTEXT = null;
  let DOWNLOAD_CAPTURE_CONTROLLER = null;
  const DOWNLOAD_MERGE_QUEUE = [];
  const DOWNLOAD_MERGE_RUNNING_JOBS = new Set();
  let DOWNLOAD_MERGE_RUNNING = 0;
  let DOWNLOAD_MERGE_RUNNING_BYTES = 0;
  let DOWNLOAD_WORKSPACE_CATALOG = [];
  let DOWNLOAD_WORKSPACE_COLLECTION = [];
  const DOWNLOAD_ACTIVE_FETCH_TIMEOUT = 10e3;
  const DOWNLOAD_MAX_MERGE_CONCURRENCY = 4;
  const DOWNLOAD_TASK_DISPLAY_LIMIT = 100;
  let DOWNLOAD_TASK_VISIBLE_LIMIT = DOWNLOAD_TASK_DISPLAY_LIMIT;
  const DOWNLOAD_CAPTURE_STATS = {
    version: VERSION,
    captureCount: 0,
    rejectedCount: 0,
    hookInstalled: false,
    playurlFetchResponses: 0,
    playurlXhrResponses: 0,
    globalReads: 0,
    videoTracks: 0,
    audioTracks: 0,
    lastSource: "",
    lastEndpoint: "",
    lastResult: "waiting",
    lastRejectReason: "",
    lastIdentity: "",
    lastDuration: 0,
    lastCaptureAt: 0,
    cacheCleared: 0,
    lastCacheClearReason: "",
    lastUrlVideoId: "",
    lastRouteKey: "",
    urlChangeCount: 0,
    activeFetchCount: 0,
    activeFetchSuccessCount: 0,
    activeFetchFailureCount: 0,
    lastActiveFetchSource: "",
    lastActiveFetchResult: "idle",
    lastActiveFetchError: "",
    lastActiveFetchAt: 0,
    catalogCount: 0,
    selectedCount: 0,
    batchActive: false,
    batchMode: "",
    mergeQueued: 0,
    mergeRunning: 0,
    effectiveMergeConcurrency: 1,
    memoryBudgetBytes: 0,
    lastBatchError: "",
    collectionCount: 0,
    collectionSelectedCount: 0,
    collectionBatchActive: false,
    collectionBatchMode: "",
    lastCollectionError: "",
    activeTaskCount: 0,
    globalDownloadSpeedBytes: 0,
    globalLoadedBytes: 0,
    globalTotalBytes: 0,
    globalDownloadProgress: 0,
    globalRemuxProgress: 0,
    globalSaveProgress: 0,
    globalOverallProgress: 0,
    downloadEtaMs: 0,
    remuxEtaMs: 0,
    totalEtaMs: 0,
    remuxModelReady: false,
    remuxSampleCount: 0,
    lastRemuxSampleMs: 0
  };
  readDownloadRemuxModel();
  try {
    Object.defineProperty(window, "__BILIKIT_DOWNLOAD_STATS__", {
      configurable: true,
      get: () => ({ ...DOWNLOAD_CAPTURE_STATS })
    });
  } catch {
  }
  function downloadAllowedUrl(value) {
    if (typeof value !== "string" || !value || value.length > 16000) return "";
    try {
      const url = new URL(value, location.href);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== "https:" || url.username || url.password || !DOWNLOAD_ALLOWED_PORTS.has(url.port)) return "";
      if (!DOWNLOAD_ALLOWED_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) return "";
      return value;
    } catch {
      return "";
    }
  }
  function normalizeDownloadTrack(raw, kind, qualityLabel) {
    if (!raw || typeof raw !== "object") return null;
    const candidates = [raw.baseUrl, raw.base_url, raw.url, ...(Array.isArray(raw.urls) ? raw.urls : []), ...(Array.isArray(raw.backupUrl) ? raw.backupUrl : []), ...(Array.isArray(raw.backup_url) ? raw.backup_url : [])];
    const urls = [...new Set(candidates.map(downloadAllowedUrl).filter(Boolean))];
    if (!urls.length) return null;
    return {
      kind,
      urls,
      id: Number(raw.id) || 0,
      codecs: String(raw.codecs || "").slice(0, 80),
      mimeType: String(raw.mimeType || raw.mime_type || "").slice(0, 80),
      width: Number(raw.width) || 0,
      height: Number(raw.height) || 0,
      frameRate: String(raw.frameRate || raw.frame_rate || "").slice(0, 24),
      bandwidth: Number(raw.bandwidth) || 0,
      qualityLabel: String(qualityLabel || "").slice(0, 40),
      audioLabel: String(raw.codecs || "").slice(0, 40)
    };
  }
  function downloadMediaHeaders(extra = {}) {
    const origin = String(location?.origin || "https://www.bilibili.com");
    return { Origin: origin, Referer: `${origin}/`, ...extra };
  }
  function normalizeDownloadSnapshot(source) {
    if (!source || typeof source !== "object") return null;
    const videos = Array.isArray(source.videos) ? source.videos.slice(0, 32).map((track) => normalizeDownloadTrack(track, "video", track.qualityLabel)).filter(Boolean) : [];
    const audios = Array.isArray(source.audios) ? source.audios.slice(0, 16).map((track) => normalizeDownloadTrack(track, "audio", "")).filter(Boolean) : [];
    const videoId = normalizedDownloadVideoId(source.videoId || source.bvid);
    const bvid = normalizedDownloadBvid(videoId);
    return {
      title: normalizeDownloadTitle(source.title) || "Bilibili 视频",
      filenameTitle: normalizeDownloadTitle(source.filenameTitle || source.seasonTitle || source.title) || "Bilibili 视频",
      videoId,
      bvid,
      aid: normalizedDownloadAid(source.aid || String(videoId || "").match(/^av(\d+)$/i)?.[1]),
      cid: String(source.cid || "").slice(0, 32),
      page: Math.max(1, Math.min(999, Number(source.page) || 1)),
      downloadScope: String(source.downloadScope || "episodes"),
      seasonId: String(source.seasonId || "").match(/^\d+$/)?.[0] || "",
      epId: String(source.epId || "").match(/^\d+$/)?.[0] || "",
      seasonIndex: Math.max(0, Math.floor(Number(source.seasonIndex) || 0)),
      seasonLabel: normalizeDownloadTitle(source.seasonLabel),
      seasonTitle: normalizeDownloadTitle(source.seasonTitle),
      multiSeason: !!source.multiSeason,
      episodeIndex: Math.max(0, Math.floor(Number(source.episodeIndex) || 0)),
      quality: Number(source.quality) || 0,
      duration: Math.max(0, Number(source.duration) || 0),
      routeKey: String(source.routeKey || "").slice(0, 500),
      captureSource: String(source.captureSource || "").slice(0, 80),
      capturePriority: Number(source.capturePriority) || 0,
      videos,
      audios
    };
  }
  function normalizedDownloadBvid(value) {
    const match = String(value || "").match(/^BV[0-9A-Za-z]+$/i);
    if (!match) return "";
    // B 站 BV 号正文大小写敏感；只能统一前缀，不能整体 toLowerCase。
    return `BV${match[0].slice(2)}`;
  }
  function normalizedDownloadVideoId(value) {
    const text = String(value || "");
    const bvid = normalizedDownloadBvid(text);
    if (bvid) return bvid;
    const avid = text.match(/^av(\d+)$/i);
    return avid ? `av${avid[1]}` : "";
  }
  function normalizedDownloadAid(value) {
    return String(value || "").match(/^\d+$/)?.[0] || "";
  }
  function downloadVideoIdentityMatches(leftId, leftAid, rightId, rightAid) {
    const left = normalizedDownloadVideoId(leftId);
    const right = normalizedDownloadVideoId(rightId);
    if (!left || !right) return false;
    if (left === right) return true;
    const leftBvid = normalizedDownloadBvid(left);
    const rightBvid = normalizedDownloadBvid(right);
    // 两侧都已经是 BV 时，BV 正文就是最高优先级身份；不能因为测试数据或
    // 旧状态里残留了相同 aid，就把两个不同 BV 合并成同一个视频。
    if (leftBvid && rightBvid) return leftBvid === rightBvid;
    const resolveAid = (videoId, aid) => normalizedDownloadAid(aid) || videoId.match(/^av(\d+)$/)?.[1] || "";
    const leftResolvedAid = resolveAid(left, leftAid);
    const rightResolvedAid = resolveAid(right, rightAid);
    return !!leftResolvedAid && leftResolvedAid === rightResolvedAid;
  }
  function downloadPageIdentityMatches(page, rightId, rightAid) {
    const right = normalizedDownloadVideoId(rightId);
    if (!right) return false;
    return [page?.videoId, page?.bvid].filter(Boolean).some((leftId) => downloadVideoIdentityMatches(leftId, page?.aid, right, rightAid));
  }
  function parseDownloadPageUrl(value = location.href) {
    try {
      const url = new URL(value, location.href);
      const pathMatch = url.pathname.match(/\/video\/((?:BV[0-9A-Za-z]+|av\d+))(?:\/|$)/i);
      const bangumiMatch = url.pathname.match(/\/bangumi\/play\/(ss|ep)(\d+)(?:\/|$)/i);
      const queryBvid = String(url.searchParams.get("bvid") || "").match(/^BV[0-9A-Za-z]+$/i)?.[0] || "";
      const queryAid = String(url.searchParams.get("aid") || "").match(/^\d+$/)?.[0] || "";
      const videoId = normalizedDownloadVideoId(pathMatch?.[1] || queryBvid || (queryAid ? `av${queryAid}` : ""));
      const bvid = normalizedDownloadBvid(videoId);
      const aid = normalizedDownloadAid(videoId.match(/^av(\d+)$/i)?.[1] || (!bvid ? queryAid : ""));
      const page = Number(url.searchParams.get("p")) || 0;
      const cid = String(url.searchParams.get("cid") || "");
      const seasonId = String(url.searchParams.get("season_id") || (bangumiMatch?.[1]?.toLowerCase() === "ss" ? bangumiMatch[2] : "")).match(/^\d+$/)?.[0] || "";
      const epId = String(url.searchParams.get("ep_id") || (bangumiMatch?.[1]?.toLowerCase() === "ep" ? bangumiMatch[2] : "")).match(/^\d+$/)?.[0] || "";
      const downloadScope = bangumiMatch ? "bangumi" : "episodes";
      const pathname = url.pathname.replace(/\/+$/, "") || "/";
      // pathname 中包含大小写敏感的 BV 号；不要把整个路径转小写。
      const routePathname = pathname.replace(/(\/video\/)((?:BV[0-9A-Za-z]+|av\d+))/i, (_match, prefix, id) => `${prefix}${normalizedDownloadVideoId(id)}`);
      const baseKey = `${url.origin.toLowerCase()}${routePathname}`;
      return {
        href: url.href,
        videoId,
        bvid,
        aid,
        page,
        cid,
        downloadScope,
        seasonId,
        epId,
        baseKey,
        routeKey: bangumiMatch
          ? `${baseKey}|season=${seasonId || "unknown"}|ep=${epId || "unknown"}|cid=${cid || "unknown"}`
          : `${baseKey}|p=${page || "unknown"}|cid=${cid || "unknown"}`
      };
    } catch {
      return { href: "", videoId: "", bvid: "", aid: "", page: 0, cid: "", downloadScope: "episodes", seasonId: "", epId: "", baseKey: "", routeKey: "" };
    }
  }
  function readDownloadMeta(name, attribute = "name") {
    try {
      return document.querySelector(`meta[${attribute}="${name}"]`)?.content || "";
    } catch {
      return "";
    }
  }
  function normalizeDownloadTitle(value) {
    return String(value || "")
      .replace(/[\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  }
  function isGenericDownloadTitle(value) {
    const title = normalizeDownloadTitle(value);
    return !title || /^(?:P\s*\d+[_\-:：\s]*)?(?:哔哩哔哩|bilibili)(?:[_\-:：\s]*(?:哔哩哔哩|bilibili))*$/i.test(title) || /^(?:BV|av)\w+$/i.test(title);
  }
  function selectDownloadTitle(...values) {
    return values.map(normalizeDownloadTitle).find((value) => !isGenericDownloadTitle(value)) || "";
  }
  function readDownloadPageTitle() {
    const selectors = [
      "#viewbox_report h1",
      ".viewbox_report h1",
      "#viewbox_report .video-title",
      ".viewbox_report .video-title",
      ".video-info-title",
      "h1.video-title",
      ".video-title"
    ];
    for (const selector of selectors) {
      let nodes = [];
      try {
        nodes = [...document.querySelectorAll(selector)];
      } catch {
      }
      for (const node of nodes) {
        const title = normalizeDownloadTitle(node?.innerText || node?.textContent);
        if (!isGenericDownloadTitle(title)) return title;
      }
    }
    return "";
  }
  function refreshDownloadSnapshotTitle(snapshot, page = null) {
    if (!snapshot || typeof snapshot !== "object") return snapshot;
    const title = selectDownloadTitle(page?.title, readDownloadPageTitle(), snapshot.title);
    if (title) snapshot.title = title;
    return snapshot;
  }
  function formatDownloadEpisodeDuration(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    if (!seconds) return "时长未知";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const rest = seconds % 60;
    return hours ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  function readDownloadEpisodeCatalogFromDom(basePage = currentDownloadPageIdentity()) {
    if (basePage?.downloadScope === "bangumi") {
      return basePage.videoId || basePage.epId
        ? [normalizeDownloadBangumiEntry({
          ...basePage,
          episodeIndex: 1,
          source: "page"
        }, basePage, 0)]
        : [];
    }
    const entries = [];
    let nodes = [];
    try {
      const activeItem = document.querySelector(".bpx-player-ctrl-eplist-multi-menu-item.bpx-state-multi-active-item");
      const activeGroup = activeItem?.closest(".bpx-player-ctrl-eplist-episodes");
      nodes = activeGroup
        ? [...activeGroup.querySelectorAll(".bpx-player-ctrl-eplist-episodes-content > li")]
        : activeItem
          ? [activeItem]
          : [...document.querySelectorAll(".bpx-player-ctrl-eplist-episodes-content > li")].slice(0, 1);
    } catch {
    }
    nodes.forEach((node, index) => {
      const rawText = normalizeDownloadTitle(node?.textContent || "");
      const pageText = normalizeDownloadTitle(node?.querySelector(".bpx-player-ctrl-eplist-multi-menu-item-text")?.textContent || "");
      const page = Number(pageText.match(/(?:P|第)\s*0*(\d+)/i)?.[1]) || index + 1;
      const cid = String(node?.getAttribute("data-cid") || "").match(/^\d+$/)?.[0] || "";
      const durationText = rawText.match(/(?:\d{1,2}:)?\d{1,2}:\d{2}$/)?.[0] || "";
      const durationParts = durationText.split(":").map((part) => Number(part) || 0);
      const duration = durationParts.length === 3
        ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
        : durationParts.length === 2 ? durationParts[0] * 60 + durationParts[1] : 0;
      if (!cid && page !== Number(basePage.page)) return;
      entries.push({
        videoId: basePage.videoId,
        bvid: basePage.bvid,
        aid: basePage.aid,
        page,
        cid,
        part: pageText || `P${page}`,
        title: basePage.title,
        duration,
        durationLabel: durationText || formatDownloadEpisodeDuration(duration),
        source: "dom"
      });
    });
    if (!entries.length && basePage.videoId) {
      entries.push({
        videoId: basePage.videoId,
        bvid: basePage.bvid,
        aid: basePage.aid,
        page: Math.max(1, Number(basePage.page) || 1),
        cid: String(basePage.cid || ""),
        part: `P${Math.max(1, Number(basePage.page) || 1)}`,
        title: basePage.title,
        duration: Number(basePage.duration) || 0,
        durationLabel: formatDownloadEpisodeDuration(basePage.duration),
        source: "page"
      });
    }
    return entries.sort((left, right) => left.page - right.page);
  }
  function readDownloadBangumiSeasonTabs(basePage = currentDownloadPageIdentity()) {
    if (basePage?.downloadScope !== "bangumi") return [];
    const tabs = [];
    const seen = new Set();
    const addTab = (button, wrapper, fallbackIndex) => {
      const seasonId = String(button?.getAttribute?.("data-item-id") || "").match(/^\d+$/)?.[0] || "";
      if (!seasonId || seen.has(seasonId)) return;
      const seasonLabel = normalizeDownloadTitle(button?.textContent || button?.innerText) || `第${fallbackIndex}季`;
      const activeId = String(wrapper?.getAttribute?.("data-active-id") || "");
      const active = activeId === seasonId || !!button?.classList?.contains?.("SectionTabs_active__cms8S") || seasonId === String(basePage?.seasonId || "");
      seen.add(seasonId);
      tabs.push({
        seasonIndex: tabs.length + 1,
        seasonId,
        seasonLabel,
        seasonTitle: seasonLabel,
        current: active,
        source: "dom"
      });
    };
    try {
      const sections = [...document.querySelectorAll("section")];
      for (const section of sections) {
        const heading = normalizeDownloadTitle(section.querySelector?.("h3")?.textContent || "");
        const wrappers = [...(section.querySelectorAll?.("[data-active-id]") || [])];
        const wrapper = wrappers.find((node) => node.querySelectorAll?.("button[data-item-id]")?.length) || section;
        const buttons = [...(wrapper.querySelectorAll?.("button[data-item-id]") || [])];
        if (!buttons.length || heading && !/正片/.test(heading)) continue;
        buttons.forEach((button) => addTab(button, wrapper, tabs.length + 1));
        if (tabs.length) break;
      }
      if (!tabs.length) {
        const buttons = [...document.querySelectorAll("button[data-item-id]")];
        buttons.forEach((button) => addTab(button, button.closest?.("[data-active-id]"), tabs.length + 1));
      }
    } catch {
    }
    if (!tabs.length && basePage?.seasonId) {
      const label = selectDownloadTitle(basePage.seasonTitle, basePage.filenameTitle, basePage.title) || "当前季度";
      tabs.push({ seasonIndex: 1, seasonId: String(basePage.seasonId), seasonLabel: label, seasonTitle: label, current: true, source: "page" });
    } else if (basePage?.seasonId && !seen.has(String(basePage.seasonId))) {
      const label = selectDownloadTitle(basePage.seasonTitle, basePage.filenameTitle, basePage.title) || "当前季度";
      tabs.push({ seasonIndex: tabs.length + 1, seasonId: String(basePage.seasonId), seasonLabel: label, seasonTitle: label, current: true, source: "page" });
    }
    return tabs;
  }
  function normalizeDownloadCollectionPages(entry) {
    const rawPages = Array.isArray(entry?.pages) && entry.pages.length
      ? entry.pages
      : entry?.page && typeof entry.page === "object"
        ? [entry.page]
        : entry?.cid
          ? [{ page: entry.page, cid: entry.cid, part: entry.part || entry.title, duration: entry.duration }]
          : [];
    const seen = new Set();
    return rawPages.map((rawPage, index) => {
      const page = Math.max(1, Math.floor(Number(rawPage?.page ?? rawPage?.page_num) || index + 1));
      const cid = String(rawPage?.cid || "").match(/^\d+$/)?.[0] || "";
      const part = normalizeDownloadTitle(rawPage?.part || rawPage?.title || (entry?.pages?.length > 1 ? `P${page}` : entry?.part || entry?.title));
      const duration = Math.max(0, Number(rawPage?.duration) || 0);
      return { page, cid, part, duration };
    }).filter((page) => {
      if (!page.cid && !page.part) return false;
      // B 站页面状态与 view 响应合并时可能重复带上首个 page；同一条目的
      // 同一 CID 只保留一次，避免全选产生重复下载任务。
      const key = page.cid ? `cid:${page.cid}` : `page:${page.page}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((left, right) => left.page - right.page || left.cid.localeCompare(right.cid));
  }
  function downloadCollectionPageCount(entry, pages = []) {
    const declaredCount = Number(entry?.collectionPageCount || entry?.pageCount) || 0;
    // /x/web-interface/view 的 ugc_season episode 在不同页面/版本中有两种
    // 形状：pages 可能是完整的 P 数组，也可能只是一个数字（表示 P 数量）。
    // 数字不能直接生成缺少 CID 的叶子项，但必须先保留数量，避免后续补齐
    // 官方 view 数据时把多 P 条目错误收缩成单 P。
    const rawPagesCount = Array.isArray(entry?.pages) ? entry.pages.length : Number(entry?.pages) || 0;
    const normalizedPagesCount = Array.isArray(pages) ? pages.length : 0;
    return Math.max(1, Math.floor(declaredCount), Math.floor(rawPagesCount), Math.floor(normalizedPagesCount));
  }
  function normalizeDownloadCollectionEntry(entry, basePage, fallbackIndex = 0) {
    const collectionIndex = Math.max(1, Math.floor(Number(entry?.collectionIndex ?? entry?.index ?? fallbackIndex + 1) || fallbackIndex + 1));
    const bvid = normalizedDownloadBvid(entry?.bvid || entry?.videoId);
    const videoId = normalizedDownloadVideoId(entry?.videoId || bvid || (entry?.aid ? `av${entry.aid}` : ""));
    const aid = normalizedDownloadAid(entry?.aid || String(videoId || "").match(/^av(\d+)$/i)?.[1]);
    const pages = normalizeDownloadCollectionPages(entry);
    const requestedPage = Math.max(1, Math.floor(Number(entry?.page ?? entry?.partPage) || 1));
    const selectedPage = pages.find((item) => item.page === requestedPage) || pages[0] || null;
    const page = selectedPage?.page || requestedPage;
    const cid = String(entry?.cid || selectedPage?.cid || "").match(/^\d+$/)?.[0] || "";
    const duration = Math.max(0, Number(entry?.duration) || Number(selectedPage?.duration) || 0);
    const sameVideo = downloadVideoIdentityMatches(videoId, aid, basePage?.videoId, basePage?.aid);
    const sameCid = !!cid && !!basePage?.cid && String(cid) === String(basePage.cid);
    const samePage = Number(page) === Number(basePage?.page || 0);
    return {
      kind: "collection",
      collectionIndex,
      page,
      collectionPageCount: downloadCollectionPageCount(entry, pages),
      pages,
      videoId,
      bvid,
      aid,
      cid,
      title: selectDownloadTitle(entry?.title, entry?.collectionTitle, entry?.part) || "Bilibili 视频",
      part: normalizeDownloadTitle(entry?.part || selectedPage?.part || entry?.title) || `合集视频 ${collectionIndex}`,
      duration,
      durationLabel: String(entry?.durationLabel || formatDownloadEpisodeDuration(duration)),
      source: String(entry?.source || "state"),
      collectionExpanded: entry?.collectionExpanded === true,
      // 只有明确的 BV/AV 条目才会进入统一合集列表；当前标记还必须落到
      // 当前 CID/分 P，不能因为同一 BV 下有多个 P 就把它们全标成当前项。
      current: !!entry?.current && (!basePage?.cid || !cid || sameCid) ||
        sameCid || sameVideo && (!basePage?.cid && samePage)
    };
  }
  function isConfirmedDownloadCollectionCatalog(entries) {
    const list = Array.isArray(entries) ? entries : [];
    if (list.length < 2) return false;
    const identities = new Set(list.map((entry) => {
      const bvid = normalizedDownloadBvid(entry?.bvid || entry?.videoId);
      return bvid || normalizedDownloadAid(entry?.aid) || "";
    }));
    // 只有每一项都有明确的 BV/AV，且至少存在两个不同的视频身份，才是
    // 合集。播放器选集 DOM 在官方 view 返回前通常只有 CID，不能先显示 C
    // 列表，否则同 BV 多 P 会短暂地被误判成合集。
    return !identities.has("") && identities.size >= 2;
  }
  function confirmedDownloadCollectionCatalog(entries, basePage = null) {
    const normalized = (Array.isArray(entries) ? entries : [])
      .map((entry, index) => normalizeDownloadCollectionEntry(entry, basePage, index))
      .sort((left, right) => left.collectionIndex - right.collectionIndex || left.page - right.page);
    return isConfirmedDownloadCollectionCatalog(normalized) ? normalized : [];
  }
  function expandDownloadCollectionCatalog(entries, basePage = null) {
    const roots = (Array.isArray(entries) ? entries : [])
      .map((entry, index) => normalizeDownloadCollectionEntry(entry, basePage, index));
    const expanded = [];
    for (const root of roots) {
      // 工作台刷新时会再次经过统一列表构造。已经展开的 Cxx_Pyy 条目
      // 不能被当成只有一个页面的根条目，否则会丢掉 P 后缀和内部 P 的独立身份。
      if (root.collectionExpanded) {
        expanded.push(root);
        continue;
      }
      const pages = root.pages.length ? root.pages : [{ page: root.page, cid: root.cid, part: root.part, duration: root.duration }];
      const pageCount = Math.max(1, root.pages.length ? pages.length : Number(root.collectionPageCount) || 1);
      for (const page of pages) {
        expanded.push(normalizeDownloadCollectionEntry({
          ...root,
          pages: [],
          page: page.page,
          cid: page.cid || root.cid,
          part: page.part || root.part,
          duration: page.duration || root.duration,
          durationLabel: formatDownloadEpisodeDuration(page.duration || root.duration),
          collectionPageCount: pageCount,
          current: false,
          collectionExpanded: true
        }, basePage, root.collectionIndex - 1));
      }
    }
    const seen = new Set();
    return expanded
      .sort((left, right) => left.collectionIndex - right.collectionIndex || left.page - right.page)
      .filter((entry) => {
        // 统一视频列表的最小身份是合集序号 + BVID/AV + P + CID。
        // 不能只按 Cxx 去重，否则同一合集视频的多个 P 会被吞掉；也不能
        // 只按 CID 去重，否则不同合集条目的异常重复页会混入错误任务。
        const identity = [
          entry.collectionIndex,
          normalizedDownloadVideoId(entry.videoId || entry.bvid || entry.aid),
          entry.page,
          entry.cid || "unknown"
        ].join(":");
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      });
  }
  function resolveDownloadScopeMode(collectionEntries, basePage = null) {
    return confirmedDownloadCollectionCatalog(collectionEntries, basePage).length ? "collection" : "episodes";
  }
  function readDownloadCollectionCatalog(basePage = currentDownloadPageIdentity()) {
    if (basePage?.downloadScope === "bangumi") return [];
    const entries = [];
    const state = window.__INITIAL_STATE__ || {};
    const videoData = state.videoData || state.videoInfo || state.epInfo || {};
    const season = videoData.ugc_season || state.sectionsInfo || {};
    const sections = Array.isArray(season.sections) ? season.sections : [];
    let collectionIndex = 0;
    for (const section of sections) {
      for (const episode of Array.isArray(section?.episodes) ? section.episodes : []) {
        const page = episode?.page && typeof episode.page === "object" ? episode.page : {};
        const arc = episode?.arc || {};
        const episodePage = Number(episode?.page) || Number(episode?.page_num) || 1;
        const entry = normalizeDownloadCollectionEntry({
          collectionIndex: ++collectionIndex,
          bvid: episode?.bvid || arc?.bvid,
          aid: episode?.aid || arc?.aid,
          cid: episode?.cid || page?.cid || arc?.cid,
          page: page?.page || episodePage,
          pages: episode?.pages,
          title: episode?.title || arc?.title || page?.part,
          part: page?.part || episode?.title || arc?.title,
          duration: page?.duration || episode?.duration || arc?.duration,
          current: downloadVideoIdentityMatches(
            episode?.bvid || arc?.bvid,
            episode?.aid || arc?.aid,
            basePage?.videoId || basePage?.bvid,
            basePage?.aid
          ),
          source: "state"
        }, basePage, collectionIndex - 1);
        if (entry.videoId) entries.push(entry);
      }
    }
    if (!entries.length) {
      let roots = [];
      try {
        const sections = [...document.querySelectorAll(".bpx-player-ctrl-eplist-section-content")]
          .filter((section) => section?.children);
        for (const section of sections) {
          for (const node of [...section.children]) {
            if (node.matches?.("li.bpx-player-ctrl-eplist-multi-menu-item")) {
              roots.push({
                collectionIndex: roots.length + 1,
                bvid: node.getAttribute("data-bvid") || node.getAttribute("data-video-id"),
                cid: node.getAttribute("data-cid"),
                title: node.querySelector(".bpx-player-ctrl-eplist-multi-menu-item-text")?.textContent,
                part: node.querySelector(".bpx-player-ctrl-eplist-multi-menu-item-text")?.textContent,
                current: node.classList.contains("bpx-state-multi-active-item"),
                source: "dom"
              });
              continue;
            }
            if (!node.matches?.(".bpx-player-ctrl-eplist-episodes")) continue;
            const groupTitle = node.querySelector(".bpx-player-ctrl-eplist-episodes-title-text")?.textContent || "";
            const pages = [...node.querySelectorAll(".bpx-player-ctrl-eplist-episodes-content > li")].map((item, index) => ({
              page: Number(normalizeDownloadTitle(item.querySelector(".bpx-player-ctrl-eplist-multi-menu-item-text")?.textContent).match(/(?:P|第)?\s*0*(\d+)/i)?.[1]) || index + 1,
              cid: item.getAttribute("data-cid"),
              part: item.querySelector(".bpx-player-ctrl-eplist-multi-menu-item-text")?.textContent,
              current: item.classList.contains("bpx-state-multi-active-item")
            }));
            roots.push({
              collectionIndex: roots.length + 1,
              bvid: node.getAttribute("data-bvid") || node.getAttribute("data-video-id"),
              title: groupTitle,
              part: groupTitle,
              pages,
              current: pages.some((page) => page.current),
              source: "dom"
            });
          }
        }
      } catch {
      }
      if (!roots.length) {
        let nodes = [];
        try {
          nodes = [...document.querySelectorAll(
            ".bpx-player-ctrl-eplist-episodes-content > li, " +
            ".bpx-player-ctrl-eplist-multi-menu-item[data-bvid], " +
            ".bpx-player-ctrl-eplist-multi-menu-item[data-video-id]"
          )];
        } catch {
        }
        roots = nodes.map((node, index) => ({
          collectionIndex: index + 1,
          bvid: node.getAttribute("data-bvid") || node.getAttribute("data-video-id"),
          cid: node.getAttribute("data-cid"),
          title: node.querySelector(".bpx-player-ctrl-eplist-multi-menu-item-text")?.textContent,
          part: node.querySelector(".bpx-player-ctrl-eplist-multi-menu-item-text")?.textContent,
          current: node.classList.contains("bpx-state-multi-active-item"),
          source: "dom"
        }));
      }
      roots.forEach((rawEntry, index) => {
        const entry = normalizeDownloadCollectionEntry(rawEntry, basePage, index);
        if (entry.videoId || entry.cid) entries.push(entry);
      });
    }
    // DOM 只负责提供顺序、标题和 CID；没有明确 BV/AV 时仍不能证明是合集，
    // 统一列表会先使用当前 BV 的 P 目录，官方 view 返回后再切换为 C/P 展开项。
    const confirmed = confirmedDownloadCollectionCatalog(entries, basePage);
    return confirmed.length ? expandDownloadCollectionCatalog(confirmed, basePage) : [];
  }
  async function fetchDownloadViewData(basePage, signal) {
    if (!basePage?.videoId || !canDownloadRequestJson()) throw new Error("当前页面没有可识别的视频 ID");
    const viewUrl = new URL("https://api.bilibili.com/x/web-interface/view");
    if (basePage.bvid) viewUrl.searchParams.set("bvid", basePage.bvid);
    else if (basePage.aid) viewUrl.searchParams.set("aid", basePage.aid);
    else throw new Error("当前视频的 AV/BV ID 不可用");
    const response = await downloadRequestJson(viewUrl.href, { signal });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`视频信息接口 HTTP ${response.status}`);
    }
    const data = payload?.data;
    const returnedId = normalizedDownloadVideoId(data?.bvid || (data?.aid ? `av${data.aid}` : ""));
    if (!response.ok || Number(payload?.code) !== 0 || !data || returnedId && !downloadVideoIdentityMatches(basePage.videoId, basePage.aid, returnedId, data.aid)) {
      throw new Error(`视频信息接口 HTTP ${response.status}`);
    }
    return { data, returnedId };
  }
  function normalizeBangumiDuration(value) {
    const number = Math.max(0, Number(value) || 0);
    return number > 10000 ? number / 1000 : number;
  }
  function normalizeDownloadBangumiEntry(entry, basePage, fallbackIndex = 0) {
    const episodeIndex = Math.max(1, Math.floor(Number(entry?.episodeIndex || entry?.index || entry?.episode_index || fallbackIndex + 1) || fallbackIndex + 1));
    const seasonId = String(entry?.seasonId || basePage?.seasonId || "").match(/^\d+$/)?.[0] || "";
    const seasonIndex = Math.max(1, Math.floor(Number(entry?.seasonIndex || basePage?.seasonIndex || 1) || 1));
    const seasonTitle = selectDownloadTitle(entry?.seasonTitle, entry?.seasonLabel, basePage?.seasonTitle, basePage?.filenameTitle) || "当前季度";
    const seasonLabel = selectDownloadTitle(entry?.seasonLabel, entry?.seasonTitle, seasonTitle) || seasonTitle;
    const epId = String(entry?.epId || entry?.episode_id || "").match(/^\d+$/)?.[0] || "";
    const bvid = normalizedDownloadBvid(entry?.bvid || entry?.videoId);
    const aid = normalizedDownloadAid(entry?.aid || String(entry?.videoId || "").match(/^av(\d+)$/i)?.[1]);
    const videoId = normalizedDownloadVideoId(entry?.videoId || bvid || (aid ? `av${aid}` : ""));
    const cid = String(entry?.cid || "").match(/^\d+$/)?.[0] || "";
    const title = selectDownloadTitle(entry?.title, entry?.showTitle, entry?.longTitle, entry?.part) || `第${episodeIndex}集`;
    const duration = normalizeBangumiDuration(entry?.duration);
    const current = !!entry?.current ||
      (!!epId && !!basePage?.epId && epId === String(basePage.epId)) ||
      (!!cid && !!basePage?.cid && cid === String(basePage.cid)) ||
      (!!videoId && downloadVideoIdentityMatches(videoId, aid, basePage?.videoId, basePage?.aid));
    return {
      kind: "bangumi-episode",
      downloadScope: "bangumi",
      episodeIndex,
      seasonId,
      seasonIndex,
      seasonLabel,
      seasonTitle,
      multiSeason: !!entry?.multiSeason || !!basePage?.multiSeason,
      epId,
      videoId,
      bvid,
      aid,
      cid,
      page: 1,
      title,
      part: normalizeDownloadTitle(entry?.longTitle || entry?.showTitle || entry?.part || title) || title,
      duration,
      durationLabel: String(entry?.durationLabel || formatDownloadEpisodeDuration(duration)),
      badge: normalizeDownloadTitle(entry?.badge),
      filenameTitle: selectDownloadTitle(entry?.filenameTitle, basePage?.filenameTitle, basePage?.seasonTitle, basePage?.title) || "Bilibili 视频",
      source: String(entry?.source || "pgc-season"),
      current
    };
  }
  function buildDownloadBangumiCatalogFromSeason(data, basePage, seasonMeta = {}) {
    const seasonId = String(data?.season_id || basePage?.seasonId || "").match(/^\d+$/)?.[0] || "";
    const seasonTitle = selectDownloadTitle(data?.season_title, data?.title, basePage?.filenameTitle, basePage?.title) || "Bilibili 视频";
    const seasonIndex = Math.max(1, Math.floor(Number(seasonMeta?.seasonIndex || basePage?.seasonIndex || 1) || 1));
    const seasonLabel = selectDownloadTitle(seasonMeta?.seasonLabel, seasonMeta?.seasonTitle, data?.season_title, seasonTitle) || `第${seasonIndex}季`;
    const multiSeason = !!seasonMeta?.multiSeason || !!basePage?.multiSeason;
    const episodes = Array.isArray(data?.episodes) ? data.episodes : [];
    return episodes.map((episode, index) => normalizeDownloadBangumiEntry({
      seasonId,
      seasonIndex,
      seasonLabel,
      seasonTitle,
      multiSeason,
      epId: episode?.ep_id,
      episodeIndex: episode?.index || episode?.episode_index || episode?.sort,
      aid: episode?.aid,
      bvid: episode?.bvid,
      cid: episode?.cid,
      title: episode?.show_title || episode?.title || episode?.long_title,
      showTitle: episode?.show_title,
      longTitle: episode?.long_title,
      duration: episode?.duration,
      badge: episode?.badge,
      filenameTitle: seasonTitle,
      current: String(episode?.ep_id || "") === String(basePage?.epId || "") && !!basePage?.epId ||
        String(episode?.cid || "") === String(basePage?.cid || "") && !!basePage?.cid ||
        !!seasonMeta?.currentSeason && !basePage?.epId && !basePage?.cid && !basePage?.videoId && index === 0,
      source: "pgc-season"
    }, { ...basePage, seasonId, seasonIndex, seasonLabel, filenameTitle: seasonTitle, seasonTitle, multiSeason }, index));
  }
  async function fetchDownloadBangumiSeasonData(basePage, signal) {
    if (!canDownloadRequestJson()) throw new Error("当前页面无法读取番剧目录");
    const seasonUrl = new URL("https://api.bilibili.com/pgc/view/web/season");
    if (basePage?.seasonId) seasonUrl.searchParams.set("season_id", String(basePage.seasonId));
    else if (basePage?.epId) seasonUrl.searchParams.set("ep_id", String(basePage.epId));
    else throw new Error("当前番剧缺少 season_id/ep_id");
    const response = await downloadRequestJson(seasonUrl.href, { signal });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`番剧目录接口 HTTP ${response.status}`);
    }
    if (!response.ok || Number(payload?.code) !== 0 || !payload?.result) {
      throw new Error(`番剧目录接口返回 ${Number(payload?.code) || response.status || "未知错误"}`);
    }
    return payload.result;
  }
  async function fetchDownloadBangumiCatalog(basePage, signal, fallback = []) {
    const data = await fetchDownloadBangumiSeasonData(basePage, signal);
    const catalog = buildDownloadBangumiCatalogFromSeason(data, basePage);
    if (!catalog.length) throw new Error("番剧目录没有可下载的正片集");
    return catalog;
  }
  async function fetchDownloadBangumiCatalogBundle(basePage, signal, fallback = []) {
    const tabs = readDownloadBangumiSeasonTabs(basePage);
    const seasonTabs = tabs.length ? tabs : [{
      seasonIndex: 1,
      seasonId: String(basePage?.seasonId || ""),
      seasonLabel: selectDownloadTitle(basePage?.seasonTitle, basePage?.filenameTitle, basePage?.title) || "当前季度",
      seasonTitle: selectDownloadTitle(basePage?.seasonTitle, basePage?.filenameTitle, basePage?.title) || "当前季度",
      current: true,
      source: "page"
    }];
    const multiSeason = new Set(seasonTabs.map((tab) => tab.seasonId).filter(Boolean)).size > 1;
    const gate = createDownloadBatchResolutionGate(2);
    const catalogs = await Promise.all(seasonTabs.map(async (tab) => {
      let release = null;
      try {
        release = await gate.acquire(signal);
        const currentSeason = tab.seasonId === String(basePage?.seasonId || "") || !basePage?.seasonId && !!tab.current;
        const seasonPage = {
          ...basePage,
          seasonId: tab.seasonId || basePage?.seasonId || "",
          epId: currentSeason ? basePage?.epId || "" : "",
          cid: currentSeason ? basePage?.cid || "" : "",
          videoId: currentSeason ? basePage?.videoId || "" : "",
          bvid: currentSeason ? basePage?.bvid || "" : "",
          aid: currentSeason ? basePage?.aid || "" : "",
          seasonIndex: tab.seasonIndex,
          seasonLabel: tab.seasonLabel,
          seasonTitle: tab.seasonTitle,
          multiSeason
        };
        const data = await fetchDownloadBangumiSeasonData(seasonPage, signal);
        return buildDownloadBangumiCatalogFromSeason(data, seasonPage, { ...tab, currentSeason, multiSeason });
      } catch {
        return [];
      } finally {
        release?.();
      }
    }));
    gate.cancel();
    const entries = catalogs.flat();
    if (entries.length) return entries;
    const currentTab = seasonTabs.find((tab) => tab.current) || seasonTabs[0];
    return (fallback || []).map((entry, index) => normalizeDownloadBangumiEntry({
      ...entry,
      seasonIndex: currentTab?.seasonIndex || 1,
      seasonLabel: currentTab?.seasonLabel,
      seasonTitle: currentTab?.seasonTitle,
      multiSeason
    }, basePage, index));
  }
  function buildDownloadEpisodeCatalogFromView(data, basePage, returnedId = "") {
    const pageItems = Array.isArray(data?.pages) && data.pages.length
      ? data.pages
      : data?.cid ? [{ page: basePage.page, cid: data.cid, part: `P${basePage.page}` }] : [];
    const viewEntries = pageItems.map((item, index) => ({
      videoId: returnedId || basePage.videoId,
      bvid: normalizedDownloadBvid(data?.bvid) || basePage.bvid,
      aid: normalizedDownloadAid(data?.aid) || basePage.aid,
      page: Number(item?.page) || index + 1,
      cid: String(item?.cid || ""),
      part: item?.part || `P${Number(item?.page) || index + 1}`,
      title: basePage.title,
      duration: Number(item?.duration) || 0,
      durationLabel: formatDownloadEpisodeDuration(item?.duration),
      source: "view"
    }));
    return viewEntries;
  }
  function buildDownloadCollectionCatalogFromView(data, basePage) {
    const seasonSections = Array.isArray(data?.ugc_season?.sections) ? data.ugc_season.sections : [];
    const episodes = seasonSections.flatMap((section) => Array.isArray(section?.episodes) ? section.episodes : []);
    const official = [];
    let collectionIndex = 0;
    for (const episode of episodes) {
      const episodePage = episode?.page && typeof episode.page === "object" ? episode.page : {};
      const arc = episode?.arc || {};
      const entry = normalizeDownloadCollectionEntry({
        collectionIndex: ++collectionIndex,
        bvid: episode?.bvid || arc?.bvid,
        aid: episode?.aid || arc?.aid,
        cid: episode?.cid || episodePage?.cid || arc?.cid,
        pages: episode?.pages,
        title: episode?.title || arc?.title || episodePage?.part,
        part: episodePage?.part || episode?.title || arc?.title,
        duration: episodePage?.duration || episode?.duration || episode?.duration_seconds,
        current: downloadVideoIdentityMatches(episode?.bvid || arc?.bvid, episode?.aid || arc?.aid, basePage.videoId, basePage.aid),
        source: "view"
      }, basePage, collectionIndex - 1);
      if (entry.videoId) official.push(entry);
    }
    const confirmed = confirmedDownloadCollectionCatalog(official, basePage);
    return confirmed.length ? expandDownloadCollectionCatalog(confirmed, basePage) : [];
  }
  async function fetchDownloadCatalogBundle(basePage, signal, domEntries = [], domCollection = []) {
    if (basePage?.downloadScope === "bangumi") {
      const fallbackCatalog = (domEntries || []).map((entry, index) => normalizeDownloadBangumiEntry(entry, basePage, index));
      try {
        return { catalog: await fetchDownloadBangumiCatalogBundle(basePage, signal, fallbackCatalog), collection: [] };
      } catch {
        return { catalog: fallbackCatalog, collection: [] };
      }
    }
    const fallbackCatalog = (domEntries || []).map((entry) => normalizeDownloadCatalogEntry(entry, basePage));
    const fallbackCollection = confirmedDownloadCollectionCatalog(domCollection, basePage);
    try {
      const { data, returnedId } = await fetchDownloadViewData(basePage, signal);
      const viewEntries = buildDownloadEpisodeCatalogFromView(data, basePage, returnedId);
      const officialCollection = buildDownloadCollectionCatalogFromView(data, basePage);
      return {
        catalog: mergeDownloadEpisodeCatalog(fallbackCatalog, viewEntries, { ...basePage, videoId: returnedId || basePage.videoId }),
        // 某些页面的 view 响应只返回当前 BV 的 pages，不带 ugc_season。
        // 只要页面目录已经确认包含至少两个不同 BV，就保留它作为回退；
        // 否则刷新工作台会把“合集视频 + 其内部 P”误收缩成普通分 P列表。
        collection: officialCollection.length
          ? officialCollection
          : fallbackCollection.length
            ? expandDownloadCollectionCatalog(fallbackCollection, basePage)
            : []
      };
    } catch {
      return {
        catalog: fallbackCatalog,
        collection: fallbackCollection.length ? expandDownloadCollectionCatalog(fallbackCollection, basePage) : []
      };
    }
  }
  // 保留给旧版测试夹具和局部调用方的兼容入口。工作台打开时使用上面的
  // fetchDownloadCatalogBundle，一次复用同一个 view 响应，不会走这里两次请求。
  async function fetchDownloadEpisodeCatalog(basePage, signal, domEntries = []) {
    const fallback = (domEntries || []).map((entry) => normalizeDownloadCatalogEntry(entry, basePage));
    try {
      const { data, returnedId } = await fetchDownloadViewData(basePage, signal);
      return mergeDownloadEpisodeCatalog(fallback, buildDownloadEpisodeCatalogFromView(data, basePage, returnedId), {
        ...basePage,
        videoId: returnedId || basePage.videoId
      });
    } catch {
      return fallback;
    }
  }
  async function fetchDownloadCollectionCatalog(basePage, signal, domEntries = []) {
    const fallback = confirmedDownloadCollectionCatalog(domEntries, basePage);
    try {
      const { data } = await fetchDownloadViewData(basePage, signal);
      return buildDownloadCollectionCatalogFromView(data, basePage);
    } catch {
      return isConfirmedDownloadCollectionCatalog(fallback) ? expandDownloadCollectionCatalog(fallback, basePage) : [];
    }
  }
  function normalizeDownloadCatalogEntry(entry, basePage) {
    const page = Math.max(1, Math.floor(Number(entry?.page) || 1));
    const duration = Math.max(0, Number(entry?.duration) || 0);
    return {
      videoId: normalizedDownloadVideoId(entry?.videoId || basePage?.videoId),
      bvid: normalizedDownloadBvid(entry?.bvid || basePage?.bvid || entry?.videoId || basePage?.videoId),
      aid: normalizedDownloadAid(entry?.aid || basePage?.aid),
      page,
      cid: String(entry?.cid || "").match(/^\d+$/)?.[0] || "",
      part: normalizeDownloadTitle(entry?.part || entry?.title || `P${page}`) || `P${page}`,
      title: selectDownloadTitle(entry?.title, basePage?.title) || "Bilibili 视频",
      duration,
      durationLabel: String(entry?.durationLabel || formatDownloadEpisodeDuration(duration)),
      source: String(entry?.source || "view"),
      cidMismatch: !!entry?.cidMismatch
    };
  }
  function mergeDownloadEpisodeCatalog(domEntries, viewEntries, basePage) {
    const byPage = new Map();
    for (const entry of domEntries || []) {
      const normalized = normalizeDownloadCatalogEntry(entry, basePage);
      byPage.set(normalized.page, normalized);
    }
    for (const entry of viewEntries || []) {
      const normalized = normalizeDownloadCatalogEntry(entry, basePage);
      const previous = byPage.get(normalized.page);
      const cidMismatch = !!(previous?.cid && normalized.cid && String(previous.cid) !== String(normalized.cid));
      byPage.set(normalized.page, {
        ...previous,
        ...normalized,
        cid: normalized.cid || previous?.cid || "",
        part: normalized.part || previous?.part || `P${normalized.page}`,
        duration: normalized.duration || previous?.duration || 0,
        durationLabel: normalized.duration ? normalized.durationLabel : previous?.durationLabel || "时长未知",
        source: "view",
        cidMismatch
      });
    }
    if (!byPage.size) {
      const fallback = normalizeDownloadCatalogEntry({ page: basePage.page, cid: basePage.cid, title: basePage.title, duration: basePage.duration }, basePage);
      byPage.set(fallback.page, fallback);
    }
    return [...byPage.values()].filter((entry) => {
      if (!entry.videoId || !basePage?.videoId) return true;
      return downloadVideoIdentityMatches(entry.videoId, entry.aid, basePage.videoId, basePage.aid);
    }).sort((left, right) => left.page - right.page);
  }
  function isDownloadCatalogEntryValid(entry) {
    return !!entry && !entry.cidMismatch && /^\d+$/.test(String(entry.cid || ""));
  }
  function isDownloadCollectionEntryValid(entry) {
    // 合集条目的 CID 可能需要在任务开始时通过官方 view 接口补齐；只要
    // BVID/AV 身份明确，就允许勾选并把缺失 CID 留给 resolveDownloadCollectionPage。
    return !!entry && !!entry.videoId && (!entry.cid || /^\d+$/.test(String(entry.cid)));
  }
  function downloadVideoListLabel(entry) {
    if (entry?.downloadScope === "bangumi" || entry?.kind === "bangumi-episode") {
      if (entry?.multiSeason) {
        const season = `S${String(Math.max(1, Number(entry?.seasonIndex) || 1)).padStart(2, "0")}`;
        return `${season}E${String(Math.max(1, Number(entry?.episodeIndex) || 1)).padStart(2, "0")}`;
      }
      return `E${String(Math.max(1, Number(entry?.episodeIndex) || 1)).padStart(2, "0")}`;
    }
    if (entry?.downloadScope === "collection" || entry?.kind === "collection-page" || entry?.kind === "collection") {
      const collection = `C${String(Math.max(1, Number(entry.collectionIndex) || 1)).padStart(2, "0")}`;
      const pageCount = Math.max(1, Number(entry.collectionPageCount) || 1);
      return pageCount > 1 ? `${collection}_P${String(Math.max(1, Number(entry.page) || 1)).padStart(2, "0")}` : collection;
    }
    return `P${String(Math.max(1, Number(entry?.page) || 1)).padStart(2, "0")}`;
  }
  function downloadVideoListEntryIsCurrent(entry, basePage) {
    if (!entry || !basePage || !downloadVideoIdentityMatches(entry.videoId || entry.bvid, entry.aid, basePage.videoId || basePage.bvid, basePage.aid)) return false;
    if (entry.downloadScope === "bangumi" && entry.epId && basePage.epId) return String(entry.epId) === String(basePage.epId);
    if (entry.cid && basePage.cid) return String(entry.cid) === String(basePage.cid);
    return Number(entry.page) === Number(basePage.page || 0);
  }
  function downloadVideoListIdentity(entry) {
    const videoId = normalizedDownloadVideoId(entry?.videoId || entry?.bvid || entry?.aid);
    if (!videoId) return "";
    const cid = String(entry?.cid || "").match(/^\d+$/)?.[0] || "";
    if (cid) return `${videoId}:cid:${cid}`;
    return `${videoId}:page:${Math.max(1, Number(entry?.page) || 1)}`;
  }
  function createDownloadBatchResolutionGate(limit = 4) {
    const waiters = [];
    let active = 0;
    const max = Math.max(1, Math.min(8, Math.floor(Number(limit) || 4)));
    const pump = () => {
      while (active < max && waiters.length) {
        const waiter = waiters.shift();
        if (waiter.signal?.aborted) {
          waiter.reject(new Error("已取消"));
          continue;
        }
        active += 1;
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          active = Math.max(0, active - 1);
          pump();
        };
        waiter.cleanup?.();
        waiter.resolve(release);
      }
    };
    return {
      acquire(signal) {
        if (signal?.aborted) return Promise.reject(new Error("已取消"));
        return new Promise((resolve, reject) => {
          const waiter = { signal, resolve, reject, cleanup: null };
          if (signal?.addEventListener) {
            const onAbort = () => {
              const index = waiters.indexOf(waiter);
              if (index >= 0) waiters.splice(index, 1);
              waiter.cleanup?.();
              reject(new Error("已取消"));
            };
            signal.addEventListener("abort", onAbort, { once: true });
            waiter.cleanup = () => signal.removeEventListener("abort", onAbort);
          }
          waiters.push(waiter);
          pump();
        });
      },
      get active() { return active; },
      get queued() { return waiters.length; },
      cancel() {
        while (waiters.length) waiters.shift().reject(new Error("已取消"));
      }
    };
  }
  function downloadBatchResolutionConcurrency(scope = "episodes") {
    if (scope === "bangumi") return 2;
    const cores = Math.max(1, Number(navigator.hardwareConcurrency) || 2);
    // 这里只限制 view/playurl 身份解析，分轨任务交给 GM_download 后不经过此闸门。
    return Math.max(2, Math.min(6, Math.floor(cores / 2) || 2));
  }
  function mergeDownloadCollectionPages(primaryPages = [], additionalPages = []) {
    const byPage = new Map();
    for (const page of [...(primaryPages || []), ...(additionalPages || [])]) {
      const pageNumber = Math.max(1, Math.floor(Number(page?.page) || 1));
      const current = byPage.get(pageNumber);
      if (!current) {
        byPage.set(pageNumber, { ...page, page: pageNumber });
        continue;
      }
      // 合集目录优先于播放器 DOM；只用后来的 P 目录补齐缺失字段，
      // 不让过期 DOM CID 覆盖已经确认的 page→CID 映射。
      byPage.set(pageNumber, {
        ...current,
        cid: current.cid || page.cid || "",
        part: current.part || page.part || "",
        duration: current.duration || page.duration || 0
      });
    }
    return [...byPage.values()].sort((left, right) => left.page - right.page);
  }
  function prepareDownloadCollectionCatalog(collection = [], catalog = [], basePage = null) {
    const groups = new Map();
    for (const [index, rawEntry] of (Array.isArray(collection) ? collection : []).entries()) {
      const entry = normalizeDownloadCollectionEntry(rawEntry, basePage, index);
      const identity = normalizedDownloadVideoId(entry.videoId || entry.bvid || entry.aid);
      const key = `${entry.collectionIndex}:${identity || `unknown:${index}`}`;
      const pages = normalizeDownloadCollectionPages(rawEntry);
      const previous = groups.get(key);
      if (!previous) {
        groups.set(key, {
          ...entry,
          // 先合并为根条目，再由 expandDownloadCollectionCatalog 统一展开。
          collectionExpanded: false,
          pages,
          collectionPageCount: Math.max(1, entry.collectionPageCount, pages.length)
        });
        continue;
      }
      previous.pages = mergeDownloadCollectionPages(previous.pages, pages);
      previous.collectionPageCount = Math.max(previous.collectionPageCount, entry.collectionPageCount, previous.pages.length);
      previous.current = previous.current || entry.current;
      if (!previous.cid) previous.cid = entry.cid;
      if (!previous.part) previous.part = entry.part;
      if (!previous.title) previous.title = entry.title;
    }

    // 页面当前 BV 的普通 P 目录可能先于合集目录到达。按 BVID 补入同一合集项，
    // 这样刷新或接口返回顺序变化时仍只生成 Cxx_Pyy，不会变成 Cxx + Pyy 混合身份。
    const pagesByVideo = new Map();
    for (const [index, rawEntry] of (Array.isArray(catalog) ? catalog : []).entries()) {
      const entry = normalizeDownloadCatalogEntry(rawEntry, basePage);
      const identity = normalizedDownloadVideoId(entry.videoId || entry.bvid || entry.aid);
      if (!identity) continue;
      const pages = pagesByVideo.get(identity) || [];
      pages.push({
        page: entry.page || index + 1,
        cid: entry.cid,
        part: entry.part,
        duration: entry.duration
      });
      pagesByVideo.set(identity, pages);
    }
    for (const entry of groups.values()) {
      const identity = normalizedDownloadVideoId(entry.videoId || entry.bvid || entry.aid);
      const extraPages = pagesByVideo.get(identity) || [];
      if (!extraPages.length) continue;
      entry.pages = mergeDownloadCollectionPages(entry.pages, extraPages);
      entry.collectionPageCount = Math.max(entry.collectionPageCount, entry.pages.length);
    }
    return [...groups.values()].sort((left, right) => left.collectionIndex - right.collectionIndex);
  }
  function buildDownloadVideoList(catalog = [], collection = [], basePage = null) {
    const isBangumi = basePage?.downloadScope === "bangumi" || (Array.isArray(catalog) && catalog.some((entry) => entry?.downloadScope === "bangumi"));
    const preparedCollection = prepareDownloadCollectionCatalog(collection, catalog, basePage);
    const confirmedCollection = confirmedDownloadCollectionCatalog(preparedCollection, basePage);
    const collectionEntries = confirmedCollection.length
      ? expandDownloadCollectionCatalog(confirmedCollection, basePage).map((entry) => ({
        ...entry,
        kind: "collection-page",
        downloadScope: "collection",
        listKey: `video:${downloadVideoListIdentity(entry) || `collection:${entry.collectionIndex}:page:${entry.page}`}`,
        label: downloadVideoListLabel({ ...entry, kind: "collection-page", downloadScope: "collection" }),
        current: downloadVideoListEntryIsCurrent(entry, basePage)
      }))
      : [];
    const bangumiSource = isBangumi ? (Array.isArray(catalog) ? catalog : []) : [];
    const bangumiSeasonIds = new Set(bangumiSource.map((entry) => String(entry?.seasonId || "")).filter(Boolean));
    const multiSeason = bangumiSeasonIds.size > 1 || bangumiSource.some((entry) => entry?.multiSeason);
    const bangumiEntries = isBangumi
      ? bangumiSource
        .map((entry, index) => normalizeDownloadBangumiEntry(entry, basePage, index))
        .sort((left, right) => (left.seasonIndex - right.seasonIndex) || (left.episodeIndex - right.episodeIndex))
        .map((entry) => ({
          ...entry,
          kind: "bangumi-episode",
          downloadScope: "bangumi",
          multiSeason,
          listKey: `bangumi:${entry.seasonId || basePage?.seasonId || "unknown"}:${entry.epId || entry.videoId || entry.cid || entry.episodeIndex}`,
          label: downloadVideoListLabel({ ...entry, multiSeason }),
          current: downloadVideoListEntryIsCurrent(entry, basePage) || !!entry.current
        }))
      : [];
    const episodeEntries = isBangumi ? [] : (Array.isArray(catalog) ? catalog : [])
      .map((entry) => normalizeDownloadCatalogEntry(entry, basePage))
      .sort((left, right) => left.page - right.page)
      .map((entry) => ({
        ...entry,
        kind: "episode",
        downloadScope: "episodes",
        collectionIndex: 0,
        collectionPageCount: 1,
        listKey: `video:${downloadVideoListIdentity(entry) || `episodes:${entry.page}`}`,
        label: downloadVideoListLabel(entry),
        current: downloadVideoListEntryIsCurrent(entry, basePage)
      }));
    // 合集与普通同 BV 分 P进入同一个叶子列表。媒体身份优先使用 BVID/AV + CID，
    // 只有没有 CID 时才回退到 BVID/AV + page；这样同一 BV 内的多个 P 不会互相
    // 覆盖，不同 BV 的相同 page/CID 也不会互相覆盖。
    const result = [];
    const seenIdentities = new Set();
    const collectionPages = new Set();
    for (const entry of bangumiEntries) {
      const identity = downloadVideoListIdentity(entry) || `bangumi:${entry.episodeIndex}`;
      if (seenIdentities.has(identity)) continue;
      seenIdentities.add(identity);
      result.push({ ...entry, listOrder: result.length });
    }
    for (const entry of collectionEntries) {
      const identity = downloadVideoListIdentity(entry) || `collection:${entry.collectionIndex}:page:${entry.page}`;
      const pageIdentity = `${normalizedDownloadVideoId(entry.videoId || entry.bvid || entry.aid)}:page:${Math.max(1, Number(entry.page) || 1)}`;
      if (seenIdentities.has(identity) || collectionPages.has(pageIdentity)) continue;
      seenIdentities.add(identity);
      collectionPages.add(pageIdentity);
      result.push({ ...entry, listOrder: result.length });
    }
    for (const entry of episodeEntries) {
      const identity = downloadVideoListIdentity(entry) || `episodes:${entry.page}`;
      const pageIdentity = `${normalizedDownloadVideoId(entry.videoId || entry.bvid || entry.aid)}:page:${Math.max(1, Number(entry.page) || 1)}`;
      // 合集条目的官方 pages 是该 BV 的权威目录。页面 DOM 仍可能同时
      // 提供一份旧的普通 P 列表；同 BV/同 page 时以 Cxx_Pyy 叶子为准，
      // 但该 BV 的其它 P 仍保留，支持“合集视频 + 其内部所有 P”一起选择。
      if (collectionPages.has(pageIdentity) || seenIdentities.has(identity)) continue;
      seenIdentities.add(identity);
      result.push({ ...entry, listOrder: result.length });
    }
    return result;
  }
  function buildDownloadVideoListGroups(entries = []) {
    const groups = [];
    const byKey = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (entry?.downloadScope === "bangumi" && entry?.multiSeason) {
        const seasonIndex = Math.max(1, Number(entry?.seasonIndex) || 1);
        const seasonId = String(entry?.seasonId || "unknown");
        const key = `bangumi-season:${seasonIndex}:${seasonId}`;
        let group = byKey.get(key);
        if (!group) {
          group = {
            key,
            kind: "bangumi-season",
            seasonIndex,
            seasonId,
            label: `S${String(seasonIndex).padStart(2, "0")}`,
            title: entry?.seasonLabel || entry?.seasonTitle || `第${seasonIndex}季`,
            children: [],
            current: false,
            listOrder: Number(entry?.listOrder) || groups.length
          };
          byKey.set(key, group);
          groups.push(group);
        }
        group.children.push(entry);
        group.current = group.current || !!entry?.current;
        continue;
      }
      if (entry?.downloadScope !== "collection") {
        groups.push({
          key: `episode:${entry?.listKey || downloadVideoListIdentity(entry) || groups.length}`,
          kind: "episode",
          label: entry?.label || downloadVideoListLabel(entry),
          title: entry?.title || entry?.part || "Bilibili 视频",
          children: [entry],
          listOrder: Number(entry?.listOrder) || groups.length
        });
        continue;
      }
      const collectionIndex = Math.max(1, Number(entry?.collectionIndex) || 1);
      const videoId = normalizedDownloadVideoId(entry?.videoId || entry?.bvid || entry?.aid);
      const key = `collection:${collectionIndex}:${videoId || `page:${entry?.page || 1}`}`;
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          kind: "collection",
          collectionIndex,
          videoId,
          bvid: entry?.bvid || "",
          aid: entry?.aid || "",
          label: `C${String(collectionIndex).padStart(2, "0")}`,
          title: entry?.title || entry?.part || "Bilibili 视频",
          children: [],
          current: false,
          listOrder: Number(entry?.listOrder) || groups.length
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.children.push(entry);
      group.current = group.current || !!entry?.current;
      if (!group.title || group.title === "Bilibili 视频") group.title = entry?.title || entry?.part || group.title;
    }
    return groups
      .map((group) => ({
      ...group,
        children: group.children.slice().sort((left, right) => (
          (group.kind === "bangumi-season"
            ? (Number(left?.episodeIndex) || 0) - (Number(right?.episodeIndex) || 0)
            : (Number(left?.page) || 0) - (Number(right?.page) || 0))
          || (Number(left?.listOrder) || 0) - (Number(right?.listOrder) || 0)
        ))
      }))
      .sort((left, right) => left.listOrder - right.listOrder);
  }
  function setDownloadVideoListGroupSelection(selectedKeys, group, checked) {
    const next = new Set(selectedKeys || []);
    for (const entry of group?.children || []) {
      if (!isDownloadVideoListEntryValid(entry) || !entry?.listKey) continue;
      if (checked) next.add(entry.listKey);
      else next.delete(entry.listKey);
    }
    return next;
  }
  function isDownloadVideoListEntryValid(entry) {
    if (entry?.downloadScope === "collection") return isDownloadCollectionEntryValid(entry);
    if (entry?.downloadScope === "bangumi") return !!entry.videoId && /^\d+$/.test(String(entry.cid || "")) && /^\d+$/.test(String(entry.epId || ""));
    return isDownloadCatalogEntryValid(entry);
  }
  function downloadBatchEntryScope(entry) {
    if (entry?.downloadScope === "collection") return "collection";
    if (entry?.downloadScope === "bangumi") return "bangumi";
    return "episodes";
  }
  function downloadBatchScopeForEntries(entries = []) {
    const list = Array.isArray(entries) ? entries : [];
    const hasCollection = list.some((entry) => downloadBatchEntryScope(entry) === "collection");
    const hasEpisodes = list.some((entry) => downloadBatchEntryScope(entry) === "episodes");
    const hasBangumi = list.some((entry) => downloadBatchEntryScope(entry) === "bangumi");
    const scopeCount = [hasCollection, hasEpisodes, hasBangumi].filter(Boolean).length;
    return scopeCount > 1 ? "mixed" : hasCollection ? "collection" : hasBangumi ? "bangumi" : hasEpisodes ? "episodes" : "";
  }
  function downloadTrackCodecKey(track) {
    return String(track?.codecs || "").toLowerCase().split(/[.,]/)[0];
  }
  function selectBatchVideoTrack(tracks, target) {
    const list = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
    if (!list.length) return { track: null, degraded: true, reason: "无可用视频轨" };
    const targetId = Number(target?.id) || 0;
    const targetCodec = downloadTrackCodecKey(target);
    const sameQuality = targetId ? list.filter((track) => Number(track.id) === targetId) : [];
    const exact = sameQuality.find((track) => downloadTrackCodecKey(track) === targetCodec);
    if (exact) return { track: exact, degraded: false, reason: "" };
    if (sameQuality[0]) return { track: sameQuality[0], degraded: true, reason: "编码不可用，已改用同清晰度编码" };
    const lower = targetId ? list.filter((track) => Number(track.id) > 0 && Number(track.id) <= targetId).sort((a, b) => Number(b.id) - Number(a.id)) : [];
    if (lower[0]) return { track: lower[0], degraded: true, reason: "清晰度不可用，已改用较低清晰度" };
    return { track: list.slice().sort((a, b) => Number(a.id) - Number(b.id))[0], degraded: true, reason: "目标清晰度不可用，已改用最低可用清晰度" };
  }
  function selectBatchAudioTrack(tracks, target) {
    const list = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
    if (!list.length) return { track: null, degraded: true, reason: "无可用音频轨" };
    const codec = downloadTrackCodecKey(target);
    const sameCodec = codec ? list.filter((track) => downloadTrackCodecKey(track) === codec) : [];
    const candidates = sameCodec.length ? sameCodec : list;
    const targetRate = Number(target?.bandwidth) || 0;
    const track = candidates.slice().sort((left, right) => Math.abs((Number(left.bandwidth) || 0) - targetRate) - Math.abs((Number(right.bandwidth) || 0) - targetRate))[0];
    return { track, degraded: !sameCodec.length, reason: sameCodec.length ? "" : "音频编码不可用，已改用可用音频轨" };
  }
  function downloadTrackHeight(track) {
    const height = Number(track?.height) || 0;
    if (height > 0) return height;
    const label = String(track?.qualityLabel || "");
    const numeric = label.match(/(?:^|[^\d])(4320|2160|1440|1080|720|576|480|360)\s*[pP](?:$|[^\w])/);
    return Number(numeric?.[1]) || 0;
  }
  function estimateDownloadMemoryBytes(model) {
    const seconds = Math.max(60, Number(model?.duration) || 0);
    const video = model?.videos?.[0] || {};
    const audio = model?.audios?.[0] || {};
    const videoRate = Number(video.bandwidth) || 4e6;
    const audioRate = Number(audio.bandwidth) || 192e3;
    const height = downloadTrackHeight(video);
    const qualityFactor = Math.min(2.5, Math.max(0.75, height ? height / 1080 : 1));
    const mediaBytes = (videoRate + audioRate) * seconds / 8;
    // Worker 会同时持有两条输入和一份 MP4 输出；清晰度越高，解复用/封装缓冲
    // 的峰值通常也越高，因此把分辨率纳入预算，而不是只看时长。
    const remuxBuffer = (64 * 1024 * 1024 + mediaBytes * 0.2) * qualityFactor;
    return Math.max(64 * 1024 * 1024, Math.ceil(mediaBytes * 1.8 + remuxBuffer));
  }
  function estimateDownloadMediaBytes(model) {
    const seconds = Math.max(0, Number(model?.duration) || 0);
    const tracks = [...(model?.videos || []), ...(model?.audios || [])];
    return Math.ceil(tracks.reduce((sum, track) => {
      const bandwidth = Number(track?.bandwidth) || 0;
      return sum + (bandwidth > 0 ? bandwidth * seconds / 8 : 0);
    }, 0));
  }
  function estimateDownloadTrackBytes(track, duration) {
    const bandwidth = Number(track?.bandwidth) || 0;
    const seconds = Math.max(0, Number(duration) || 0);
    return bandwidth > 0 && seconds > 0 ? Math.ceil(bandwidth * seconds / 8) : 0;
  }
  function calculateDownloadMergeBudget(env = {}) {
    const cores = Math.max(1, Number(env.hardwareConcurrency) || 2);
    const deviceMemory = Number(env.deviceMemory) || 0;
    const heapLimit = Number(env.heapLimitBytes) || 0;
    const physicalBudget = deviceMemory > 0 ? deviceMemory * 1024 ** 3 * 0.25 : 512 * 1024 * 1024;
    const heapBudget = heapLimit > 0 ? heapLimit * 0.35 : Number.POSITIVE_INFINITY;
    const memoryBudgetBytes = Math.max(128 * 1024 * 1024, Math.min(2 * 1024 ** 3, physicalBudget, heapBudget));
    const height = Number(env.maxQualityHeight) || 0;
    const duration = Number(env.maxDuration) || 0;
    const bitrate = Number(env.maxBitrate) || 0;
    const workloadFactor = Math.max(
      height ? height / 1080 : 1,
      duration ? duration / 3600 : 1,
      bitrate ? bitrate / 8e6 : 1
    );
    const workloadCap = workloadFactor >= 2 ? 1 : workloadFactor >= 1.35 ? 2 : DOWNLOAD_MAX_MERGE_CONCURRENCY;
    const largestEstimate = Math.max(256 * 1024 * 1024, Number(env.largestEstimateBytes) || 0);
    const concurrency = Math.max(1, Math.min(
      DOWNLOAD_MAX_MERGE_CONCURRENCY,
      Math.floor(cores / 2) || 1,
      workloadCap,
      Math.floor(memoryBudgetBytes / largestEstimate) || 1
    ));
    return { memoryBudgetBytes, concurrency };
  }
  function parseDownloadDuration(value) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    const text = String(value || "").trim();
    if (!text) return 0;
    const numeric = Number(text);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const iso = text.match(/^P(?:([0-9.]+)D)?T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
    if (!iso) return 0;
    return Number(iso[1] || 0) * 86400 + Number(iso[2] || 0) * 3600 + Number(iso[3] || 0) * 60 + Number(iso[4] || 0);
  }
  function readDownloadDocumentIdentity() {
    let bvid = "";
    let title = "";
    let duration = parseDownloadDuration(readDownloadMeta("video:duration", "property"));
    const urls = [readDownloadMeta("og:url", "property"), document.querySelector('link[rel="canonical"]')?.href || ""];
    for (const value of urls) {
      const match = String(value || "").match(/\/video\/((?:BV[0-9A-Za-z]+|av\d+))/i);
      if (match) {
        if (!bvid) bvid = normalizedDownloadBvid(match[1]);
        break;
      }
    }
    title = readDownloadPageTitle() || normalizeDownloadTitle(readDownloadMeta("og:title", "property"));
    try {
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        let value;
        try {
          value = JSON.parse(script.textContent || "null");
        } catch {
          continue;
        }
        const items = Array.isArray(value) ? value : [value];
        const video = items.find((item) => item && (item["@type"] === "VideoObject" || Array.isArray(item["@type"]) && item["@type"].includes("VideoObject")));
        if (!video) continue;
        if (!bvid) {
          const match = String(video.url || video["@id"] || "").match(/\/video\/(BV[0-9A-Za-z]+)/i);
          if (match && !bvid) bvid = normalizedDownloadBvid(match[1]);
        }
        if (!title && video.name) title = normalizeDownloadTitle(video.name);
        if (!duration) duration = parseDownloadDuration(video.duration);
        break;
      }
    } catch {
    }
    return { bvid, videoId: normalizedDownloadVideoId(bvid), title, duration };
  }
  function readDownloadBangumiNextData() {
    try {
      const node = document.querySelector("script#__NEXT_DATA__");
      if (!node) return {};
      const data = JSON.parse(node.textContent || "{}");
      const queries = data?.props?.pageProps?.dehydratedState?.queries;
      const season = Array.isArray(queries)
        ? queries.map((item) => item?.state?.data).find((item) => item && (item.season_id || item.season_title))
        : null;
      return season && typeof season === "object" ? season : {};
    } catch {
      return {};
    }
  }
  function readDownloadBangumiPlayState() {
    const sources = [window.__PLAYURL_HYDRATE_DATA__, window.__playinfo__, window.__INITIAL_STATE__?.playinfo, window.__INITIAL_STATE__]
      .filter((source) => source && typeof source === "object");
    for (const source of sources) {
      const roots = [source?.result, source?.data?.result, source?.data, source].filter((root) => root && typeof root === "object");
      for (const root of roots) {
        const arc = root.arc || root.view_info?.arc || root.video_info?.arc || root.videoData?.arc || {};
        const episode = root.supplement?.ogv_episode_info || root.play_view_business_info?.episode_info || root.episode_info || root.epInfo || root.episode || {};
        const season = root.supplement?.ogv_season_info || root.play_view_business_info?.season_info || root.season_info || root.videoData?.season_info || {};
        const bvid = normalizedDownloadBvid(arc.bvid || root.bvid);
        const aid = normalizedDownloadAid(arc.aid || root.aid || root.avid || episode.aid);
        const cid = String(arc.cid || root.cid || episode.cid || root.videoData?.cid || "").match(/^\d+$/)?.[0] || "";
        const epId = String(episode.ep_id || episode.episode_id || root.ep_id || root.episode_id || root.epId || "").match(/^\d+$/)?.[0] || "";
        const seasonId = String(season.season_id || root.season_id || root.seasonId || root.videoData?.season_id || "").match(/^\d+$/)?.[0] || "";
        if (!bvid && !aid && !cid && !epId && !seasonId) continue;
        const durationValue = Number(root.timelength || root.duration || root.dash?.duration) || 0;
        return {
          videoId: normalizedDownloadVideoId(bvid || (aid ? `av${aid}` : "")),
          bvid,
          aid,
          cid,
          epId,
          seasonId,
          episodeTitle: selectDownloadTitle(episode.show_title, episode.title, episode.long_title, episode.index_title),
          seasonTitle: selectDownloadTitle(season.season_title, season.title, root.season_title, root.seasonTitle),
          duration: durationValue > 10000 ? durationValue / 1000 : durationValue
        };
      }
    }
    return {};
  }
  function readDownloadBangumiPageIdentity(urlIdentity = parseDownloadPageUrl()) {
    const state = readDownloadBangumiPlayState();
    const nextData = readDownloadBangumiNextData();
    const seasonId = urlIdentity.seasonId || state.seasonId || String(nextData.season_id || "").match(/^\d+$/)?.[0] || "";
    const epId = urlIdentity.epId || state.epId;
    const videoId = state.videoId || "";
    const bvid = state.bvid || normalizedDownloadBvid(videoId);
    const aid = state.aid || String(videoId || "").match(/^av(\d+)$/)?.[1] || "";
    const cid = state.cid || "";
    const seasonTitle = selectDownloadTitle(nextData.season_title, state.seasonTitle, readDownloadPageTitle()) ||
      normalizeDownloadTitle(document.title).replace(/[-_]番剧.*$/i, "");
    const title = selectDownloadTitle(state.episodeTitle, nextData.title, seasonTitle) || videoId || "Bilibili 视频";
    const routeKey = `${urlIdentity.routeKey || `${location.origin.toLowerCase()}${location.pathname}`}|season=${seasonId || "unknown"}|ep=${epId || "unknown"}|cid=${cid || "unknown"}`;
    return {
      ...urlIdentity,
      downloadScope: "bangumi",
      seasonId,
      epId,
      videoId,
      bvid,
      aid,
      cid,
      title,
      filenameTitle: seasonTitle || title,
      seasonTitle: seasonTitle || title,
      duration: Number(state.duration) || 0,
      page: 1,
      requiresCid: false,
      urlVideoId: videoId,
      stateVideoId: videoId,
      stateMatchesUrl: true,
      routeKey
    };
  }
  function readCurrentDownloadPlayerDuration() {
    try {
      const playerVideo = document.querySelector(".bpx-player-container video, .bilibili-player-video video");
      const video = playerVideo || document.querySelector("video");
      const duration = Number(video?.duration);
      return Number.isFinite(duration) && duration > 0 ? duration : 0;
    } catch {
      return 0;
    }
  }
  function readCurrentDownloadPlayerManifest() {
    try {
      const player = window.player;
      if (!player || typeof player.getManifest !== "function") return null;
      const manifest = player.getManifest();
      return manifest && typeof manifest === "object" && !Array.isArray(manifest) ? manifest : null;
    } catch {
      return null;
    }
  }
  function currentDownloadPageIdentity() {
    const urlIdentity = parseDownloadPageUrl();
    if (urlIdentity.downloadScope === "bangumi") return readDownloadBangumiPageIdentity(urlIdentity);
    const state = window.__INITIAL_STATE__ || {};
    const videoData = state.videoData || state.videoInfo || state.epInfo || state.data?.videoData || {};
    const documentIdentity = readDownloadDocumentIdentity();
    const playerManifest = readCurrentDownloadPlayerManifest();
    const playerBvid = normalizedDownloadBvid(playerManifest?.bvid);
    const playerAid = normalizedDownloadAid(playerManifest?.aid);
    const playerVideoId = playerBvid || (playerAid ? `av${playerAid}` : "");
    const playerMatchesUrl = !urlIdentity.videoId || !playerVideoId || downloadVideoIdentityMatches(urlIdentity.videoId, urlIdentity.aid, playerVideoId, playerAid);
    const stateBvid = normalizedDownloadBvid(videoData.bvid || state.bvid);
    const stateAid = normalizedDownloadAid(videoData.aid || state.aid);
    const stateVideoId = stateBvid || (stateAid ? `av${stateAid}` : "");
    const documentVideoId = normalizedDownloadVideoId(documentIdentity.videoId || documentIdentity.bvid);
    const stateMatchesUrl = !urlIdentity.videoId || !stateVideoId || downloadVideoIdentityMatches(urlIdentity.videoId, urlIdentity.aid, stateVideoId, stateAid);
    const documentMatchesUrl = !urlIdentity.videoId || !documentVideoId || downloadVideoIdentityMatches(urlIdentity.videoId, urlIdentity.aid, documentVideoId, "");
    const bvid = urlIdentity.bvid || (playerMatchesUrl ? playerBvid : "") || (stateMatchesUrl ? normalizedDownloadBvid(stateVideoId) : "") || (documentMatchesUrl ? normalizedDownloadBvid(documentVideoId) : "");
    const videoId = urlIdentity.videoId || (playerMatchesUrl ? playerVideoId : "") || (stateMatchesUrl ? stateVideoId : "") || (documentMatchesUrl ? documentVideoId : "");
    const pages = stateMatchesUrl && (stateVideoId || !urlIdentity.videoId)
      ? Array.isArray(videoData.pages) ? videoData.pages : Array.isArray(state.pages) ? state.pages : []
      : [];
    const queryPage = urlIdentity.page;
    const playerPage = playerMatchesUrl ? Number(playerManifest?.p) || 0 : 0;
    const statePage = stateMatchesUrl ? Number(videoData.p || videoData.page || state.p) || 0 : 0;
    const stateCid = stateMatchesUrl ? String(videoData.cid || videoData.currentCid || state.cid || "") : "";
    const playerCid = playerMatchesUrl ? String(playerManifest?.cid || "") : "";
    const selectedPageNumber = queryPage || playerPage || statePage;
    const selectedPage = queryPage > 0
      ? pages.find((item) => Number(item.page) === queryPage) || pages[queryPage - 1]
      : selectedPageNumber > 0
        ? pages.find((item) => Number(item.page) === selectedPageNumber) || pages[selectedPageNumber - 1]
        : pages.find((item) => String(item.cid) === (playerCid || stateCid)) || (pages.length === 1 ? pages[0] : null);
    const playerPageMatchesSelection = playerMatchesUrl && (!queryPage || !playerPage || playerPage === queryPage);
    const statePageMatchesSelection = stateMatchesUrl && (!queryPage || !statePage || statePage === queryPage);
    const cid = String(urlIdentity.cid || (playerPageMatchesSelection ? playerCid : "") || selectedPage?.cid || (statePageMatchesSelection ? stateCid : "") || (stateMatchesUrl ? videoData.episodeInfo?.cid : "") || "");
    const cidPage = pages.findIndex((item) => String(item.cid) === cid) + 1;
    const page = cidPage || selectedPageNumber || 1;
    // 路由键只由 URL 决定。播放响应可能早于 __INITIAL_STATE__ 更新到达，
    // 不能因为稍后才读到页面 CID 就把已经确认的当前轨道当成旧轨道清掉。
    const routeKey = urlIdentity.routeKey || `${location.origin.toLowerCase()}${location.pathname}|p=${page}|cid=${urlIdentity.cid || "unknown"}`;
    const playerDuration = readCurrentDownloadPlayerDuration();
    const metadataDuration = Number(selectedPage?.duration || videoData.duration || videoData.episodeInfo?.duration) || (documentMatchesUrl ? documentIdentity.duration : 0);
    return {
      videoId,
      bvid,
      aid: urlIdentity.aid || (playerMatchesUrl ? playerAid : "") || (stateMatchesUrl ? stateAid : "") || videoId.match(/^av(\d+)$/)?.[1] || "",
      cid,
      page,
      title: selectDownloadTitle(
        stateMatchesUrl ? videoData.title : "",
        documentMatchesUrl ? documentIdentity.title : ""
      ) || (urlIdentity.videoId ? urlIdentity.videoId : normalizeDownloadTitle(document.title).replace(/[_-]哔哩哔哩.*$/i, "")),
      duration: metadataDuration || playerDuration,
      playerDuration,
      metadataDuration,
      downloadScope: "episodes",
      seasonId: "",
      epId: "",
      filenameTitle: selectDownloadTitle(
        stateMatchesUrl ? videoData.title : "",
        documentMatchesUrl ? documentIdentity.title : ""
      ) || (urlIdentity.videoId ? urlIdentity.videoId : "Bilibili 视频"),
      requiresCid: pages.length > 1,
      urlVideoId: urlIdentity.videoId,
      stateVideoId,
      stateMatchesUrl,
      routeKey
    };
  }
  function downloadSnapshotMatchesPage(snapshot, page) {
    if (!snapshot || !page) return false;
    if (page.routeKey && snapshot.routeKey && page.routeKey !== snapshot.routeKey) return false;
    const pageVideoId = normalizedDownloadVideoId(page.videoId || page.bvid);
    const snapshotVideoId = normalizedDownloadVideoId(snapshot.videoId || snapshot.bvid);
    if (pageVideoId && snapshotVideoId && !downloadPageIdentityMatches(page, snapshotVideoId, snapshot.aid)) return false;
    if (pageVideoId && !snapshotVideoId) return false;
    if (page.cid && snapshot.cid && String(page.cid) !== String(snapshot.cid)) return false;
    if (page.cid && !snapshot.cid) return false;
    if (page.downloadScope === "bangumi") {
      if (page.seasonId && snapshot.seasonId && String(page.seasonId) !== String(snapshot.seasonId)) return false;
      if (page.epId && snapshot.epId && String(page.epId) !== String(snapshot.epId)) return false;
    }
    const pageUrl = new URL(location.href);
    const explicitPage = Number(pageUrl.searchParams.get("p")) || 0;
    if (explicitPage > 0 && Number(snapshot.page) !== explicitPage) return false;
    return true;
  }
  function downloadSnapshotMatchesCurrentPlayer(snapshot, page = currentDownloadPageIdentity()) {
    const actual = Number(page?.playerDuration) || 0;
    const captured = Number(snapshot?.duration) || 0;
    if (!actual || !captured) return true;
    return Math.abs(actual - captured) <= Math.max(3, actual * 0.03);
  }
  function downloadSnapshotMatchesDrawerRoute(snapshot, routeUrl = curUrl || activeRoute?.url || "") {
    if (!snapshot || !routeUrl) return false;
    try {
      const route = new URL(routeUrl, location.href);
      const routeIdentity = parseDownloadPageUrl(route.href);
      const routeVideoId = routeIdentity.videoId;
      const snapshotVideoId = normalizedDownloadVideoId(snapshot.videoId || snapshot.bvid);
      if (routeVideoId && snapshotVideoId && !downloadPageIdentityMatches(routeIdentity, snapshotVideoId, snapshot.aid)) return false;
      if (routeIdentity.downloadScope === "bangumi") {
        if (routeIdentity.seasonId && snapshot.seasonId && String(routeIdentity.seasonId) !== String(snapshot.seasonId)) return false;
        if (routeIdentity.epId && snapshot.epId && String(routeIdentity.epId) !== String(snapshot.epId)) return false;
      }
      const explicitPage = Number(route.searchParams.get("p")) || 0;
      if (explicitPage > 0 && Number(snapshot.page) !== explicitPage) return false;
      return !routeVideoId || !!snapshotVideoId;
    } catch {
      return false;
    }
  }
  function parseDownloadRequestIdentity(requestUrl) {
    if (!requestUrl) return { videoId: "", bvid: "", aid: "", cid: "", epId: "", seasonId: "" };
    try {
      const url = new URL(requestUrl, location.href);
      if (url.hostname.toLowerCase() !== "api.bilibili.com") return { videoId: "", bvid: "", aid: "", cid: "", epId: "", seasonId: "" };
      if (!/\/(?:x\/player\/(?:wbi\/)?playurl|pgc\/player\/(?:web\/(?:v2\/)?|api\/)playurl|pugv\/player\/web\/playurl)(?:\/|$)/i.test(url.pathname)) {
        return { videoId: "", bvid: "", aid: "", cid: "", epId: "", seasonId: "" };
      }
      const bvid = String(url.searchParams.get("bvid") || "").match(/^BV[0-9A-Za-z]+$/i)?.[0] || "";
      const aid = normalizedDownloadAid(url.searchParams.get("aid") || url.searchParams.get("avid"));
      const videoId = normalizedDownloadVideoId(bvid || (aid ? `av${aid}` : ""));
      const cid = String(url.searchParams.get("cid") || "");
      const epId = String(url.searchParams.get("ep_id") || "").match(/^\d+$/)?.[0] || "";
      const seasonId = String(url.searchParams.get("season_id") || "").match(/^\d+$/)?.[0] || "";
      return { videoId, bvid: normalizedDownloadBvid(bvid), aid, cid, epId, seasonId };
    } catch {
      return { videoId: "", bvid: "", aid: "", cid: "", epId: "", seasonId: "" };
    }
  }
  function downloadEndpoint(requestUrl) {
    try {
      const url = new URL(requestUrl, location.href);
      return url.pathname.slice(0, 160);
    } catch {
      return "";
    }
  }
  function noteDownloadCapture(sourceLabel, requestUrl = "") {
    DOWNLOAD_CAPTURE_STATS.lastSource = String(sourceLabel || "playurl").split("?")[0].slice(0, 120);
    DOWNLOAD_CAPTURE_STATS.lastEndpoint = downloadEndpoint(requestUrl);
    rememberDownloadPlayurlRequest(requestUrl);
  }
  function resolveDownloadIdentity(data, requestUrl = "") {
    const page = currentDownloadPageIdentity();
    const request = parseDownloadRequestIdentity(requestUrl);
    const isBangumi = page.downloadScope === "bangumi" || !!request.epId || !!request.seasonId;
    const responseArc = data?.arc || data?.view_info?.arc || data?.video_info?.arc || {};
    const responseEpisode = data?.episode_info || data?.episode || data?.view_info?.episode_info || {};
    const responseSeason = data?.season_info || data?.season || data?.view_info?.season_info || {};
    const response = {
      bvid: String(responseArc.bvid || data?.bvid || data?.view_info?.bvid || data?.video_info?.bvid || "").match(/^BV[0-9A-Za-z]+$/i)?.[0] || "",
      aid: normalizedDownloadAid(responseArc.aid || data?.aid || data?.avid || data?.view_info?.aid || data?.video_info?.aid),
      // B 站当前播放页的 SSR __playinfo__.data 通常没有 cid 字段，
      // 但会下发 last_play_cid；如果只读 cid，会把真实当前轨道误判成“身份未确认”。
      cid: String(responseArc.cid || data?.view_info?.cid || data?.cid || data?.video_info?.cid || ""),
      epId: String(responseEpisode.ep_id || responseEpisode.episode_id || data?.ep_id || data?.episode_id || data?.view_info?.ep_id || "").match(/^\d+$/)?.[0] || "",
      seasonId: String(responseSeason.season_id || data?.season_id || data?.view_info?.season_id || "").match(/^\d+$/)?.[0] || ""
    };
    response.videoId = normalizedDownloadVideoId(response.bvid || (response.aid ? `av${response.aid}` : ""));
    // last_play_cid 属于页面上一次播放状态，不是当前 playurl 响应的可靠身份。
    // 只有在没有请求身份、且页面自身已经确认 CID 时才允许把它作为回退值。
    if (!response.cid && !request.cid && page.cid && page.stateMatchesUrl) response.cid = String(data?.last_play_cid || data?.lastPlayCid || "");
    if (!response.videoId && !request.videoId && page.videoId && page.stateMatchesUrl) response.videoId = normalizedDownloadVideoId(data?.last_play_bvid || data?.lastPlayBvid || page.videoId);
    response.bvid = normalizedDownloadBvid(response.videoId || response.bvid);
    const reject = (reason) => ({ ok: false, reason });
    if (isBangumi && request.epId && page.epId && request.epId !== String(page.epId)) return reject("request-episode-id-mismatch");
    if (isBangumi && response.epId && page.epId && response.epId !== String(page.epId)) return reject("response-episode-id-mismatch");
    if (isBangumi && request.seasonId && page.seasonId && request.seasonId !== String(page.seasonId)) return reject("request-season-id-mismatch");
    if (isBangumi && response.seasonId && page.seasonId && response.seasonId !== String(page.seasonId)) return reject("response-season-id-mismatch");
    if (request.cid && response.cid && request.cid !== response.cid) return reject("request-response-cid-mismatch");
    if (request.videoId && response.videoId && !downloadVideoIdentityMatches(request.videoId, request.aid, response.videoId, response.aid)) return reject("request-response-video-id-mismatch");
    if (page.cid && (request.cid || response.cid) && (request.cid || response.cid) !== page.cid) return reject("page-cid-mismatch");
    if (page.videoId && (request.videoId || response.videoId) && !downloadPageIdentityMatches(page, request.videoId || response.videoId, request.aid || response.aid)) return reject("page-video-id-mismatch");
    if (page.cid && ![request.cid, response.cid].includes(page.cid)) return reject("current-cid-not-confirmed");
    if (page.requiresCid && !page.cid && !request.cid && !response.cid) return reject("current-cid-unavailable");
    if (!page.cid && page.videoId && !downloadPageIdentityMatches(page, request.videoId, request.aid) && !downloadPageIdentityMatches(page, response.videoId, response.aid)) return reject("current-video-id-not-confirmed");
    if (!page.videoId && !page.cid && !request.videoId && !response.videoId && !request.cid && !response.cid) return reject("current-page-identity-unavailable");
    if (!request.cid && !response.cid) return reject("current-cid-not-confirmed");
    // 没有 request URL 的全局 __playinfo__ 可能只是 SSR 残留。没有页面 CID
    // 时必须等待当前播放器实际发出的 playurl 请求，不能仅凭 last_play_cid 认领旧轨。
    if (!request.cid && !request.videoId && !page.cid) return reject("current-playurl-not-confirmed");
    if (page.urlVideoId && !request.videoId && !response.videoId && !page.stateMatchesUrl) return reject("current-url-needs-playurl");
    const responseDuration = Number(data.timelength) > 0
      ? Number(data.timelength) / 1000
      : Number(data.dash?.duration) || 0;
    const expectedDuration = page.duration || page.playerDuration;
    if (!request.cid && !request.videoId && !response.videoId && expectedDuration > 0 && responseDuration > 0 && Math.abs(expectedDuration - responseDuration) > Math.max(3, expectedDuration * 0.03)) {
      return reject("page-duration-mismatch");
    }
    const cid = response.cid || request.cid || page.cid;
    const videoId = normalizedDownloadVideoId(page.urlVideoId || (isBangumi ? page.videoId : "") || response.videoId || request.videoId || page.videoId);
    const bvid = normalizedDownloadBvid(response.bvid || request.bvid || page.bvid || videoId);
    const aid = normalizedDownloadAid(response.aid || request.aid || page.aid || String(videoId || "").match(/^av(\d+)$/)?.[1]);
    const cidPage = Array.isArray(window.__INITIAL_STATE__?.videoData?.pages)
      ? window.__INITIAL_STATE__.videoData.pages.findIndex((item) => String(item.cid) === cid) + 1
      : 0;
    return {
      ok: true,
      identity: {
        videoId,
        bvid,
        aid,
        cid,
        page: cidPage || page.page,
        title: page.title,
        duration: responseDuration || page.playerDuration || page.duration,
        filenameTitle: page.filenameTitle || page.seasonTitle || page.title,
        downloadScope: isBangumi ? "bangumi" : "episodes",
        seasonId: page.seasonId || request.seasonId || response.seasonId,
        epId: page.epId || request.epId || response.epId,
        seasonIndex: page.seasonIndex || 0,
        seasonLabel: page.seasonLabel || "",
        seasonTitle: page.seasonTitle || "",
        multiSeason: !!page.multiSeason,
        episodeIndex: page.episodeIndex || 0,
        routeKey: page.routeKey
      }
    };
  }
  function buildDownloadSnapshotFromPlayinfo(data, identity) {
    if (!data || typeof data !== "object" || !identity?.videoId && !identity?.bvid && !identity?.cid) return null;
    const formats = Array.isArray(data.support_formats) ? data.support_formats : [];
    const qualityName = (id) => {
      const format = formats.find((item) => Number(item.quality) === Number(id));
      return String(format?.new_description || format?.description || `画质 ${id}`).slice(0, 40);
    };
    const videos = (Array.isArray(data.dash?.video) ? data.dash.video : []).map((track) => ({
      ...track,
      qualityLabel: qualityName(track.id)
    }));
    const audios = [
      ...(Array.isArray(data.dash?.audio) ? data.dash.audio : []),
      ...(Array.isArray(data.dash?.dolby?.audio) ? data.dash.dolby.audio : []),
      ...(data.dash?.flac?.audio ? [data.dash.flac.audio] : [])
    ];
    const durationMs = Number(data.timelength) || 0;
    return normalizeDownloadSnapshot({
      title: identity.title,
      videoId: identity.videoId,
      bvid: identity.bvid,
      aid: identity.aid,
      cid: identity.cid,
      page: identity.page,
      filenameTitle: identity.filenameTitle,
      downloadScope: identity.downloadScope,
      seasonId: identity.seasonId,
      epId: identity.epId,
      seasonIndex: identity.seasonIndex,
      seasonLabel: identity.seasonLabel,
      seasonTitle: identity.seasonTitle,
      multiSeason: identity.multiSeason,
      episodeIndex: identity.episodeIndex,
      quality: data.quality,
      duration: identity.duration || (durationMs > 0 ? durationMs / 1000 : Number(data.dash?.duration) || 0),
      routeKey: identity.routeKey,
      videos,
      audios
    });
  }
  function downloadCapturePriority(sourceLabel) {
    // CDN hook 在响应被改写前保存的快照优先；no-login hook 看到的可能已经是
    // CDN 包装后的响应，只能作为 CDN hook 未启用时的回退。
    if (String(sourceLabel).includes("no-login-hook")) return 1;
    if (String(sourceLabel).includes("cdn-hook")) return 3;
    if (String(sourceLabel).includes("JSON.parse")) return 2;
    return 2;
  }
  function sameDownloadIdentity(left, right) {
    return !!left && !!right && normalizedDownloadVideoId(left.videoId || left.bvid) === normalizedDownloadVideoId(right.videoId || right.bvid) && left.cid === right.cid && left.routeKey === right.routeKey;
  }
  function clearDownloadPlayinfoCache(reason = "") {
    DOWNLOAD_PLAYINFO_CACHE = null;
    DOWNLOAD_CAPTURE_STATS.cacheCleared += 1;
    DOWNLOAD_CAPTURE_STATS.lastCacheClearReason = String(reason || "").slice(0, 120);
    DOWNLOAD_CAPTURE_STATS.lastResult = "cache-cleared";
    DOWNLOAD_CAPTURE_STATS.lastIdentity = "";
    DOWNLOAD_CAPTURE_STATS.videoTracks = 0;
    DOWNLOAD_CAPTURE_STATS.audioTracks = 0;
  }
  function syncDownloadPageIdentity(reason = "identity-check") {
    const previousRouteKey = DOWNLOAD_PAGE_ROUTE_KEY;
    const page = currentDownloadPageIdentity();
    if (previousRouteKey && previousRouteKey !== page.routeKey) {
      cancelDownloadBatch(reason);
      cancelDownloadActiveFetch(reason);
      DOWNLOAD_ACTIVE_FETCH_ROUTE_KEY = page.routeKey;
      DOWNLOAD_ACTIVE_FETCH_ATTEMPTS = 0;
      closeDownloadWorkspaceForNavigation(reason);
      clearDownloadPlayinfoCache(reason);
      DOWNLOAD_CAPTURE_STATS.urlChangeCount += 1;
      DOWNLOAD_CAPTURE_STATS.lastResult = "waiting-current-url";
    }
    DOWNLOAD_PAGE_ROUTE_KEY = page.routeKey;
    DOWNLOAD_CAPTURE_STATS.lastUrlVideoId = page.urlVideoId || page.videoId || "";
    DOWNLOAD_CAPTURE_STATS.lastRouteKey = page.routeKey;
    return page;
  }
  function publishDownloadSnapshotIfReady() {
    const snapshot = DOWNLOAD_PLAYINFO_CACHE;
    if (!snapshot) return false;
    const page = syncDownloadPageIdentity("publish-page-identity");
    refreshDownloadSnapshotTitle(snapshot, page);
    if (!downloadSnapshotMatchesPage(snapshot, page)) return false;
    if (!downloadSnapshotMatchesCurrentPlayer(snapshot, page)) {
      DOWNLOAD_CAPTURE_STATS.lastResult = "captured-waiting-player";
      return false;
    }
    if (inDrawer) {
      postDrawer("bk-drawer-download-update", { workbench: snapshot });
    } else if (DOWNLOAD_WORKSPACE_ROOT?.isConnected &&
      (Number(DOWNLOAD_WORKSPACE_ROOT.dataset.bkVideoTrackCount) === 0 || Number(DOWNLOAD_WORKSPACE_ROOT.dataset.bkAudioTrackCount) === 0)) {
      openDownloadWorkspace(snapshot);
    }
    return true;
  }
  function cacheDownloadPlayinfo(source, sourceLabel = "playurl", requestUrl = "") {
    noteDownloadCapture(sourceLabel, requestUrl);
    if (!source || typeof source !== "object") {
      DOWNLOAD_CAPTURE_STATS.lastResult = "invalid-response";
      return;
    }
    if (!isPlayPage()) {
      DOWNLOAD_CAPTURE_STATS.lastResult = "not-play-page";
      return;
    }
    const data = [source.data, source.result, source.data?.data, source.result?.data, source]
      .find((candidate) => candidate && typeof candidate === "object" && candidate.dash);
    if (!data) {
      DOWNLOAD_CAPTURE_STATS.lastResult = "no-dash";
      return;
    }
    const page = syncDownloadPageIdentity("play-page-changed");
    const resolved = resolveDownloadIdentity(data, requestUrl);
    if (!resolved.ok) {
      DOWNLOAD_CAPTURE_STATS.rejectedCount += 1;
      DOWNLOAD_CAPTURE_STATS.lastResult = "identity-rejected";
      DOWNLOAD_CAPTURE_STATS.lastRejectReason = resolved.reason;
      return;
    }
    const snapshot = buildDownloadSnapshotFromPlayinfo(data, resolved.identity);
    if (!snapshot.videos.length && !snapshot.audios.length) {
      DOWNLOAD_CAPTURE_STATS.lastResult = "no-supported-tracks";
      return;
    }
    refreshDownloadSnapshotTitle(snapshot, page);
    snapshot.captureSource = String(sourceLabel || "playurl").split("?")[0].slice(0, 80);
    snapshot.capturePriority = downloadCapturePriority(sourceLabel);
    if (sameDownloadIdentity(DOWNLOAD_PLAYINFO_CACHE, snapshot) &&
      Number(DOWNLOAD_PLAYINFO_CACHE.capturePriority) > snapshot.capturePriority) {
      DOWNLOAD_CAPTURE_STATS.lastResult = "duplicate-lower-priority";
      return;
    }
    if (DOWNLOAD_PLAYINFO_CACHE && !sameDownloadIdentity(DOWNLOAD_PLAYINFO_CACHE, snapshot)) {
      DOWNLOAD_PLAYINFO_CACHE = null;
    }
    DOWNLOAD_PLAYINFO_CACHE = snapshot;
    DOWNLOAD_CAPTURE_STATS.captureCount += 1;
    DOWNLOAD_CAPTURE_STATS.videoTracks = snapshot.videos.length;
    DOWNLOAD_CAPTURE_STATS.audioTracks = snapshot.audios.length;
    DOWNLOAD_CAPTURE_STATS.lastSource = String(sourceLabel || "playurl").split("?")[0].slice(0, 120);
    DOWNLOAD_CAPTURE_STATS.lastEndpoint = downloadEndpoint(requestUrl);
    DOWNLOAD_CAPTURE_STATS.lastResult = "captured";
    DOWNLOAD_CAPTURE_STATS.lastRejectReason = "";
    DOWNLOAD_CAPTURE_STATS.lastIdentity = `${snapshot.videoId || snapshot.bvid}:${snapshot.cid}`;
    DOWNLOAD_CAPTURE_STATS.lastDuration = snapshot.duration;
    DOWNLOAD_CAPTURE_STATS.lastCaptureAt = Date.now();
    publishDownloadSnapshotIfReady();
  }
  function readCurrentDownloadSnapshot() {
    const playInfo = window.__playinfo__;
    if (playInfo && typeof playInfo === "object") DOWNLOAD_CAPTURE_STATS.globalReads += 1;
    const data = playInfo?.data || playInfo?.result || playInfo;
    const page = syncDownloadPageIdentity("read-page-identity");
    const cached = DOWNLOAD_PLAYINFO_CACHE;
    const cacheMatchesPage = cached && downloadSnapshotMatchesPage(cached, page);
    if (cacheMatchesPage && downloadSnapshotMatchesCurrentPlayer(cached, page)) {
      refreshDownloadSnapshotTitle(cached, page);
      return cached;
    }
    if (cached && !cacheMatchesPage) clearDownloadPlayinfoCache("cached-identity-mismatch");
    const currentIdentity = resolveDownloadIdentity(data);
    const current = currentIdentity.ok ? buildDownloadSnapshotFromPlayinfo(data, currentIdentity.identity) : null;
    if (current && (current.videos.length || current.audios.length) &&
      downloadSnapshotMatchesPage(current, page) && downloadSnapshotMatchesCurrentPlayer(current, page)) return current;
    if (cached && cacheMatchesPage && !downloadSnapshotMatchesCurrentPlayer(cached, page)) {
      DOWNLOAD_CAPTURE_STATS.lastResult = "waiting-current-player";
    }
    return normalizeDownloadSnapshot({
      title: page.title,
      videoId: page.videoId,
      bvid: page.bvid,
      cid: page.cid,
      page: page.page,
      videos: [],
      audios: []
    });
  }
  function isDownloadPlayurlUrl(value) {
    if (typeof value !== "string" || !value) return false;
    return MEDIA_PLAYURL_API_RE.test(value) || /\/player\/[^/?#]*playurl/i.test(value);
  }
  const DOWNLOAD_REPLAY_PARAM_KEYS = [
    "aid", "avid", "bvid", "cid", "ep_id", "season_id", "qn", "fnval", "fnver", "fourk", "platform",
    "from_client", "web_location", "version_name", "is_main_page", "need_fragment",
    "voice_balance", "app_id", "client_attr", "gaia_source", "isGaiaAvoided", "try_look",
    "otype", "type", "session"
  ];
  function downloadPlayurlTemplateFromUrl(requestUrl) {
    try {
      const url = new URL(requestUrl, location.href);
      if (url.origin !== "https://api.bilibili.com" || !isDownloadPlayurlUrl(url.href)) return null;
      const identity = parseDownloadRequestIdentity(url.href);
      if (!identity.videoId && !identity.cid) return null;
      const params = {};
      for (const key of DOWNLOAD_REPLAY_PARAM_KEYS) {
        if (url.searchParams.has(key)) params[key] = url.searchParams.get(key);
      }
      return {
        origin: url.origin,
        pathname: url.pathname,
        params,
        videoId: identity.videoId,
        bvid: identity.bvid,
        aid: identity.aid,
        cid: identity.cid,
        epId: identity.epId,
        seasonId: identity.seasonId
      };
    } catch {
      return null;
    }
  }
  function rememberDownloadPlayurlRequest(requestUrl) {
    const template = downloadPlayurlTemplateFromUrl(requestUrl);
    if (template) DOWNLOAD_PLAYURL_TEMPLATE = template;
  }
  function downloadRequestMatchesPage(request, page) {
    if (!request || !page) return false;
    const requestPath = String(request.pathname || "").toLowerCase();
    const pageIsBangumi = page.downloadScope === "bangumi";
    const requestIsBangumi = requestPath.includes("/pgc/player/") || !!request.epId || !!request.seasonId;
    if (pageIsBangumi !== requestIsBangumi) return false;
    const requestVideoId = normalizedDownloadVideoId(request.videoId || request.bvid);
    const pageVideoId = normalizedDownloadVideoId(page.videoId || page.bvid);
    if (pageVideoId && requestVideoId && !downloadPageIdentityMatches(page, requestVideoId, request.aid)) return false;
    if (pageVideoId && !requestVideoId) return false;
    if (page.cid && request.cid && String(page.cid) !== String(request.cid)) return false;
    if (page.cid && !request.cid) return false;
    if (pageIsBangumi && page.epId && request.epId && String(page.epId) !== String(request.epId)) return false;
    if (pageIsBangumi && page.epId && !request.epId) return false;
    if (pageIsBangumi && page.seasonId && request.seasonId && String(page.seasonId) !== String(request.seasonId)) return false;
    return !!(requestVideoId || request.cid);
  }
  function findRecentDownloadPlayurlUrl(page) {
    try {
      const entries = performance.getEntriesByType("resource");
      for (let i = entries.length - 1; i >= 0; i--) {
        const requestUrl = String(entries[i]?.name || "");
        const template = downloadPlayurlTemplateFromUrl(requestUrl);
        if (!template || !downloadRequestMatchesPage(template, page)) continue;
        return requestUrl;
      }
    } catch {
    }
    return "";
  }
  function downloadPlayurlParams(page, template) {
    const params = { ...(template?.params || {}) };
    if (page?.downloadScope === "bangumi") {
      delete params.aid;
      delete params.bvid;
      delete params.avid;
      if (page.aid) params.avid = String(page.aid);
      else delete params.avid;
      if (page.cid) params.cid = String(page.cid);
      else delete params.cid;
      if (page.epId) params.ep_id = String(page.epId);
      else delete params.ep_id;
      if (page.seasonId) params.season_id = String(page.seasonId);
      else delete params.season_id;
      params.qn = params.qn || "80";
      params.fnval = params.fnval || "4048";
      params.fnver = params.fnver || "0";
      params.fourk = params.fourk || "1";
      params.platform = params.platform || "pc";
      return params;
    }
    delete params.aid;
    delete params.avid;
    delete params.bvid;
    if (page.bvid) params.bvid = page.bvid;
    const aid = page.aid || String(page.videoId || "").match(/^av(\d+)$/)?.[1] || "";
    if (aid) params.avid = aid;
    if (page.cid) params.cid = String(page.cid);
    else delete params.cid;
    params.qn = params.qn || "80";
    params.fnval = params.fnval || "4048";
    params.fnver = params.fnver || "0";
    params.fourk = params.fourk || "1";
    params.platform = params.platform || "pc";
    params.try_look = params.try_look || "1";
    return params;
  }
  async function buildDownloadPlayurlRequest(page, allowRecent = true) {
    const recent = allowRecent ? findRecentDownloadPlayurlUrl(page) : "";
    if (recent) return { url: recent, source: "performance" };
    const template = DOWNLOAD_PLAYURL_TEMPLATE && downloadRequestMatchesPage(DOWNLOAD_PLAYURL_TEMPLATE, page)
      ? DOWNLOAD_PLAYURL_TEMPLATE
      : null;
    const origin = template?.origin || "https://api.bilibili.com";
    const pathname = page?.downloadScope === "bangumi"
      ? (template?.pathname && /\/pgc\/player\//i.test(template.pathname) ? template.pathname : "/pgc/player/web/playurl")
      : template?.pathname || "/x/player/wbi/playurl";
    const url = new URL(origin + pathname);
    const params = downloadPlayurlParams(page, template);
    const needsWbi = page?.downloadScope !== "bangumi" && /\/x\/player\/wbi\/playurl$/i.test(pathname);
    if (needsWbi) {
      let signed = signQuery(params);
      if (!signed && canDownloadRequestJson()) {
        try {
          await ensureKeys((url, options) => downloadRequestJson(url, options), 2500);
        } catch {
        }
        signed = signQuery(params);
      }
      if (!signed) throw new Error("WBI 密钥不可用");
      return { url: `${url.href}?${signed}`, source: template ? "wbi-template" : "wbi-default" };
    }
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return { url: url.href, source: template ? "template" : "official-endpoint" };
  }
  async function buildBatchDownloadPlayurlRequest(page) {
    // 不同 BV 合集必须从当前条目的 BV/CID 重新构造官方请求；即使模板恰好
    // 来自合集中的当前 BV，也不能把当前页的签名请求当作另一条任务的身份。
    const template = page?.downloadScope === "collection" ? null : DOWNLOAD_PLAYURL_TEMPLATE && page?.videoId && downloadRequestMatchesPage(
      DOWNLOAD_PLAYURL_TEMPLATE,
      page
    ) && downloadVideoIdentityMatches(
      page.videoId,
      page.aid,
      DOWNLOAD_PLAYURL_TEMPLATE.videoId,
      DOWNLOAD_PLAYURL_TEMPLATE.aid
    ) ? DOWNLOAD_PLAYURL_TEMPLATE : null;
    const pathname = page?.downloadScope === "bangumi"
      ? (template?.pathname && /\/pgc\/player\//i.test(template.pathname) ? template.pathname : "/pgc/player/web/playurl")
      : template?.pathname || "/x/player/wbi/playurl";
    const url = new URL((template?.origin || "https://api.bilibili.com") + pathname);
    const params = downloadPlayurlParams(page, template);
    if (page?.downloadScope !== "bangumi" && /\/x\/player\/wbi\/playurl$/i.test(pathname)) {
      let signed = signQuery(params);
      if (!signed && canDownloadRequestJson()) {
        try {
          await ensureKeys((url, options) => downloadRequestJson(url, options), 2500);
        } catch {
        }
        signed = signQuery(params);
      }
      if (!signed) throw new Error("WBI 密钥不可用");
      return { url: `${url.href}?${signed}`, source: template ? "batch-wbi-template" : "batch-wbi-default" };
    }
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return { url: url.href, source: template ? "batch-template" : "batch-official-endpoint" };
  }
  function buildLegacyDownloadPlayurlRequest(page, batch = false) {
    const url = new URL("https://api.bilibili.com/x/player/playurl");
    const params = downloadPlayurlParams(page, null);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return { url: url.href, source: batch ? "batch-legacy-endpoint" : "legacy-endpoint" };
  }
  function isWbiDownloadPlayurlRequest(request) {
    try {
      return /\/x\/player\/wbi\/playurl$/i.test(new URL(request?.url || "", location.href).pathname);
    } catch {
      return false;
    }
  }
  function canFallbackDownloadPlayurl(page, request) {
    return page?.downloadScope !== "bangumi" && isWbiDownloadPlayurlRequest(request);
  }
  function hasDownloadDashTracks(data) {
    const dash = data?.dash;
    return !!dash && (Array.isArray(dash.video) && dash.video.length > 0 || Array.isArray(dash.audio) && dash.audio.length > 0);
  }
  async function buildDownloadPlayurlRequestWithLegacyFallback(page, { batch = false, allowRecent = true } = {}) {
    try {
      return batch
        ? await buildBatchDownloadPlayurlRequest(page)
        : await buildDownloadPlayurlRequest(page, allowRecent);
    } catch (error) {
      if (page?.downloadScope !== "bangumi" && /WBI 密钥/.test(String(error?.message || error))) {
        return buildLegacyDownloadPlayurlRequest(page, batch);
      }
      throw error;
    }
  }
  async function fetchDownloadPlayurlResponse(request, signal) {
    let response;
    try {
      response = await downloadRequestJson(request.url, { signal });
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error || "播放接口请求失败"));
      if (!signal?.aborted) failure.downloadApiFailure = true;
      throw failure;
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      const error = new Error(`播放接口 HTTP ${response.status}`);
      error.downloadApiFailure = true;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`播放接口 HTTP ${response.status}`);
      error.downloadApiFailure = true;
      throw error;
    }
    if (Number(payload?.code) !== 0) {
      const error = new Error(`播放接口返回 ${Number(payload?.code) || "未知错误"}`);
      error.downloadApiFailure = true;
      throw error;
    }
    return { payload, data: payload?.data || payload?.result || payload };
  }
  async function fetchDownloadPlayurlWithLegacyFallback(page, request, signal, batch = false) {
    let activeRequest = request;
    let result;
    try {
      result = await fetchDownloadPlayurlResponse(activeRequest, signal);
    } catch (error) {
      if (!canFallbackDownloadPlayurl(page, activeRequest) || signal?.aborted) throw error;
      activeRequest = buildLegacyDownloadPlayurlRequest(page, batch);
      result = await fetchDownloadPlayurlResponse(activeRequest, signal);
    }
    if (canFallbackDownloadPlayurl(page, activeRequest) && !hasDownloadDashTracks(result.data)) {
      activeRequest = buildLegacyDownloadPlayurlRequest(page, batch);
      result = await fetchDownloadPlayurlResponse(activeRequest, signal);
    }
    return { ...result, request: activeRequest };
  }
  function buildBatchDownloadSnapshot(data, page, requestUrl) {
    const request = parseDownloadRequestIdentity(requestUrl);
    const responseArc = data?.arc || data?.view_info?.arc || data?.video_info?.arc || {};
    const responseEpisode = data?.episode_info || data?.episode || data?.view_info?.episode_info || {};
    const responseSeason = data?.season_info || data?.season || data?.view_info?.season_info || {};
    const responseBvid = normalizedDownloadBvid(responseArc.bvid || data?.bvid || data?.view_info?.bvid || data?.video_info?.bvid);
    const responseAid = normalizedDownloadAid(responseArc.aid || data?.aid || data?.avid || data?.view_info?.aid || data?.video_info?.aid);
    const responseVideoId = normalizedDownloadVideoId(responseBvid || (responseAid ? `av${responseAid}` : ""));
    const responseEpId = String(responseEpisode.ep_id || responseEpisode.episode_id || data?.ep_id || data?.episode_id || data?.view_info?.ep_id || "").match(/^\d+$/)?.[0] || "";
    const responseSeasonId = String(responseSeason.season_id || data?.season_id || data?.view_info?.season_id || "").match(/^\d+$/)?.[0] || "";
    const isBangumi = page?.downloadScope === "bangumi";
    if (request.videoId && !downloadVideoIdentityMatches(page.videoId, page.aid, request.videoId, request.aid)) throw new Error("播放请求的视频 ID 不匹配");
    if (responseVideoId && !downloadVideoIdentityMatches(page.videoId, page.aid, responseVideoId, responseAid)) throw new Error("播放响应的视频 ID 不匹配");
    if (isBangumi && page.epId && request.epId !== String(page.epId)) throw new Error("番剧播放请求的集 ID 不匹配");
    if (isBangumi && page.epId && responseEpId && responseEpId !== String(page.epId)) throw new Error("番剧播放响应的集 ID 不匹配");
    if (isBangumi && page.seasonId && request.seasonId && request.seasonId !== String(page.seasonId)) throw new Error("番剧播放请求的季 ID 不匹配");
    if (isBangumi && page.seasonId && responseSeasonId && responseSeasonId !== String(page.seasonId)) throw new Error("番剧播放响应的季 ID 不匹配");
    const responseCid = String(responseArc.cid || data?.cid || data?.view_info?.cid || data?.video_info?.cid || "");
    if (request.cid && request.cid !== String(page.cid)) throw new Error("播放请求的 CID 不匹配");
    if (responseCid && responseCid !== String(page.cid)) throw new Error("播放响应的 CID 不匹配");
    if (!page.cid) throw new Error(isBangumi ? "目标番剧集的 CID 不可用" : "目标分 P 的 CID 不可用");
    const identity = {
      videoId: page.videoId || request.videoId || responseVideoId,
      bvid: page.bvid || request.bvid || responseBvid,
      aid: page.aid || request.aid || responseAid,
      cid: String(page.cid),
      page: Number(page.page) || 1,
      title: page.title,
      filenameTitle: page.filenameTitle || page.seasonTitle || page.title,
        downloadScope: isBangumi ? "bangumi" : "episodes",
        seasonId: page.seasonId || request.seasonId || responseSeasonId,
        epId: page.epId || request.epId || responseEpId,
        seasonIndex: page.seasonIndex || 0,
        seasonLabel: page.seasonLabel || "",
        seasonTitle: page.seasonTitle || "",
        multiSeason: !!page.multiSeason,
        episodeIndex: page.episodeIndex || 0,
      duration: Number(data?.timelength) > 0 ? Number(data.timelength) / 1000 : Number(data?.dash?.duration) || Number(page.duration) || 0,
      routeKey: page.routeKey || `${page.videoId || page.bvid}|${isBangumi ? `season=${page.seasonId || "unknown"}|ep=${page.epId || "unknown"}` : `p=${Number(page.page) || 1}`}|cid=${page.cid}`
    };
    return buildDownloadSnapshotFromPlayinfo(data, identity);
  }
  async function fetchBatchDownloadSnapshot(page, signal) {
    const initialRequest = await buildDownloadPlayurlRequestWithLegacyFallback(page, { batch: true });
    const result = await fetchDownloadPlayurlWithLegacyFallback(page, initialRequest, signal, true);
    const { data, request } = result;
    if (!hasDownloadDashTracks(data)) {
      if (page?.downloadScope === "bangumi" && (Number(data?.is_preview) === 1 || data?.is_preview === true)) {
        throw new Error("番剧接口仅返回预览或会员资源，当前账号没有可用的 DASH 音视频轨");
      }
      throw new Error("当前分 P 没有可用的 DASH 音视频轨");
    }
    const snapshot = buildBatchDownloadSnapshot(data, page, request.url);
    if (!snapshot?.videos.length && !snapshot?.audios.length) throw new Error("当前分 P 没有可用的 DASH 音视频轨");
    return { snapshot, source: request.source };
  }
  function downloadActiveErrorMessage(error) {
    const raw = String(error?.message || error || "未知错误").trim();
    if (!raw || /aborted|aborterror/i.test(raw)) return "请求已取消";
    if (/超时/.test(raw)) return "播放接口请求超时，请点击“重新获取轨道”重试";
    if (/WBI 密钥/.test(raw)) return "无法取得 B 站播放接口签名，请刷新页面后重试";
    if (/预览或会员资源/.test(raw)) return raw;
    if (/没有 DASH/.test(raw)) return "当前视频没有可用的 DASH 音视频轨";
    if (/CID/.test(raw)) return raw;
    return raw
      .replace(/https?:\/\/\S+/gi, "播放接口")
      .replace(/[?&][^\s]+/g, "")
      .slice(0, 180);
  }
  function publishDownloadActiveStatus(state, message = "", source = "") {
    const status = String(state || "idle");
    if (source) DOWNLOAD_CAPTURE_STATS.lastActiveFetchSource = source;
    DOWNLOAD_CAPTURE_STATS.lastActiveFetchResult = status;
    if (message) DOWNLOAD_CAPTURE_STATS.lastActiveFetchError = status === "error" ? message : "";
    try {
      updateDownloadWorkspaceFetchStatus({ state: status, message });
    } catch {
    }
    if (inDrawer) postDrawer("bk-drawer-download-fetch-status", { state: status, message: String(message || "").slice(0, 180) });
  }
  async function resolveDownloadPageForFetch(page, signal) {
    if (page.cid && page.downloadScope !== "bangumi") return page;
    if (page.downloadScope === "bangumi") {
      if (!page.epId && !page.seasonId && !page.videoId && !page.cid) throw new Error("当前番剧缺少可识别的集或季 ID");
      const data = await fetchDownloadBangumiSeasonData(page, signal);
      const catalog = buildDownloadBangumiCatalogFromSeason(data, page);
      const selected = catalog.find((entry) => page.epId && String(entry.epId) === String(page.epId))
        || catalog.find((entry) => page.bvid && entry.bvid === page.bvid)
        || catalog.find((entry) => page.cid && String(entry.cid) === String(page.cid))
        // /bangumi/play/ss... 是纯季目录页，可能没有当前 ep_id/BVID/CID。
        // 这里只选一集正片建立清晰度/音频选择基准；批量任务仍会为每个
        // E 条目单独请求自己的 ep_id、BVID 和 CID。
        || catalog.find((entry) => entry?.cid);
      if (!selected?.cid) throw new Error("当前番剧集的 CID 不可用");
      return {
        ...page,
        seasonId: selected.seasonId || page.seasonId,
        epId: selected.epId || page.epId,
        episodeIndex: selected.episodeIndex,
        videoId: selected.videoId || page.videoId,
        bvid: selected.bvid || page.bvid,
        aid: selected.aid || page.aid,
        cid: selected.cid,
        title: selected.title || page.title,
        filenameTitle: selected.filenameTitle || page.filenameTitle,
        seasonTitle: selected.filenameTitle || page.seasonTitle,
        duration: selected.duration || page.duration,
        page: 1
      };
    }
    if (!page.videoId) throw new Error("当前页面没有可识别的视频 ID");
    const viewUrl = new URL("https://api.bilibili.com/x/web-interface/view");
    if (page.bvid) viewUrl.searchParams.set("bvid", page.bvid);
    else {
      const aid = page.aid || String(page.videoId || "").match(/^av(\d+)$/)?.[1] || "";
      if (!aid) throw new Error("当前视频的 AV ID 不可用");
      viewUrl.searchParams.set("aid", aid);
    }
    const response = await downloadRequestJson(viewUrl.href, { signal });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error(`视频信息接口 HTTP ${response.status}`);
    }
    if (!response.ok) throw new Error(`视频信息接口 HTTP ${response.status}`);
    if (Number(payload?.code) !== 0 || !payload?.data) {
      throw new Error(`视频信息接口返回 ${Number(payload?.code) || "未知错误"}`);
    }
    const data = payload.data;
    const returnedBvid = normalizedDownloadBvid(data.bvid);
    const returnedAid = normalizedDownloadAid(data.aid);
    const returnedVideoId = normalizedDownloadVideoId(returnedBvid || (returnedAid ? `av${returnedAid}` : ""));
    if (returnedVideoId && !downloadVideoIdentityMatches(page.videoId, page.aid, returnedVideoId, returnedAid)) {
      throw new Error("视频信息与当前 URL 不一致");
    }
    const pages = Array.isArray(data.pages) ? data.pages : [];
    const explicitPage = parseDownloadPageUrl().page;
    const statePage = page.stateMatchesUrl ? Number(page.page) || 0 : 0;
    const wantedPage = explicitPage || statePage;
    let selected = wantedPage > 0 ? pages.find((item) => Number(item.page) === wantedPage) : null;
    if (!selected && pages.length === 1) selected = pages[0];
    if (!selected && pages.length > 1) throw new Error("当前视频包含多个分 P，请先在 URL 中指定 p 参数");
    const cid = String(selected?.cid || data.cid || "");
    if (!cid) throw new Error("当前视频的 CID 不可用");
    return {
      ...page,
      bvid: returnedBvid || page.bvid,
      videoId: page.videoId || returnedVideoId,
      cid,
      page: Number(selected?.page) || wantedPage || 1,
      aid: String(data.aid || page.aid || "").match(/^\d+$/)?.[0] || page.aid || ""
    };
  }
  function cancelDownloadActiveFetch(reason = "已取消") {
    const active = DOWNLOAD_ACTIVE_FETCH;
    if (!active) return;
    active.cancelReason = reason;
    try {
      active.controller.abort(reason);
    } catch {
    }
  }
  function fetchCurrentDownloadPlayinfo(manual = false) {
    if (!isPlayPage()) return Promise.resolve(null);
    if (DOWNLOAD_ACTIVE_FETCH) return DOWNLOAD_ACTIVE_FETCH.promise;
    const page = syncDownloadPageIdentity("active-fetch-start");
    if (!manual && DOWNLOAD_ACTIVE_FETCH_ROUTE_KEY === page.routeKey && DOWNLOAD_ACTIVE_FETCH_ATTEMPTS > 0) return Promise.resolve(null);
    DOWNLOAD_ACTIVE_FETCH_ROUTE_KEY = page.routeKey;
    DOWNLOAD_ACTIVE_FETCH_ATTEMPTS += 1;
    const controller = new AbortController();
    const active = { controller, routeKey: page.routeKey, cancelReason: "", promise: null };
    DOWNLOAD_ACTIVE_FETCH = active;
    DOWNLOAD_CAPTURE_STATS.activeFetchCount += 1;
    DOWNLOAD_CAPTURE_STATS.lastActiveFetchAt = Date.now();
    DOWNLOAD_CAPTURE_STATS.lastActiveFetchError = "";
    publishDownloadActiveStatus("loading", "正在从 B 站播放接口获取当前视频轨道…");
    const timeout = setTimeout(() => {
      try {
        controller.abort("timeout");
      } catch {
      }
    }, DOWNLOAD_ACTIVE_FETCH_TIMEOUT);
    active.promise = (async () => {
      try {
        const resolvedPage = await resolveDownloadPageForFetch(page, controller.signal);
        if (syncDownloadPageIdentity("active-fetch-cid").routeKey !== active.routeKey) throw new Error("当前页面路由已变化");
        let request = await buildDownloadPlayurlRequestWithLegacyFallback(resolvedPage);
        DOWNLOAD_CAPTURE_STATS.lastActiveFetchSource = request.source;
        let result;
        try {
          result = await fetchDownloadPlayurlWithLegacyFallback(resolvedPage, request, controller.signal);
        } catch (error) {
          if (request.source !== "performance" || !error?.downloadApiFailure) throw error;
          request = await buildDownloadPlayurlRequestWithLegacyFallback(resolvedPage, { allowRecent: false });
          DOWNLOAD_CAPTURE_STATS.lastActiveFetchSource = request.source;
          result = await fetchDownloadPlayurlWithLegacyFallback(resolvedPage, request, controller.signal);
        }
        request = result.request;
        DOWNLOAD_CAPTURE_STATS.lastActiveFetchSource = request.source;
        const { payload, data } = result;
        if (!hasDownloadDashTracks(data)) {
          if (resolvedPage?.downloadScope === "bangumi" && (Number(data?.is_preview) === 1 || data?.is_preview === true)) {
            throw new Error("番剧接口仅返回预览或会员资源，当前账号没有可用的 DASH 音视频轨");
          }
          throw new Error("当前视频没有可用的 DASH 音视频轨");
        }
        if (syncDownloadPageIdentity("active-fetch-response").routeKey !== active.routeKey) throw new Error("当前页面路由已变化");
        cacheDownloadPlayinfo(payload, "download-active-fetch", request.url);
        const snapshot = readCurrentDownloadSnapshot();
        if (!snapshot.videos.length && !snapshot.audios.length) throw new Error("当前视频没有可用的 DASH 音视频轨");
        DOWNLOAD_CAPTURE_STATS.activeFetchSuccessCount += 1;
        publishDownloadActiveStatus("success", "已获取当前视频的 DASH 音视频轨", request.source);
        return snapshot;
      } catch (error) {
        const message = downloadActiveErrorMessage(error);
        if (!/当前页面路由已变化|请求已取消/.test(message)) DOWNLOAD_CAPTURE_STATS.activeFetchFailureCount += 1;
        publishDownloadActiveStatus("error", message, DOWNLOAD_CAPTURE_STATS.lastActiveFetchSource);
        return null;
      } finally {
        clearTimeout(timeout);
        if (DOWNLOAD_ACTIVE_FETCH === active) DOWNLOAD_ACTIVE_FETCH = null;
      }
    })();
    return active.promise;
  }
  function parseDownloadPayload(value) {
    if (value && typeof value === "object") return value;
    if (typeof value !== "string" || !value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  function installDownloadCapture() {
    if (DOWNLOAD_CAPTURE_CONTROLLER) {
      DOWNLOAD_CAPTURE_CONTROLLER.enable();
      return DOWNLOAD_CAPTURE_CONTROLLER.destroy;
    }
    if (window.__BILIKIT_DOWNLOAD_CAPTURE__) return null;
    window.__BILIKIT_DOWNLOAD_CAPTURE__ = true;
    DOWNLOAD_CAPTURE_STATS.hookInstalled = true;
    let enabled = true;
    let destroyed = false;
    let untrackRuntimeCleanup = () => {};
    // 必须在 runAll()/no-login 初始化前读 SSR 播放数据：免登录模块会有意
    // 将 window.__playinfo__ 隐藏为 null，之后再安装网络钩子就已经错过首份轨道。
    try {
      const initialPlayinfo = window.__playinfo__;
      if (initialPlayinfo && typeof initialPlayinfo === "object") {
        DOWNLOAD_CAPTURE_STATS.globalReads += 1;
        cacheDownloadPlayinfo(initialPlayinfo, "download-ssr");
      }
    } catch {
      DOWNLOAD_CAPTURE_STATS.lastResult = "initial-playinfo-unavailable";
    }
    const runtime = getRuntimeCoordinator();
    const networkHooks = runtime.networkHooks();
    const removeFetchHook = networkHooks.addFetch("download-capture", (next) => function(input, init) {
      const requestUrl = urlOf(input);
      const result = next.apply(this, arguments);
      if (!enabled || !isDownloadPlayurlUrl(requestUrl)) return result;
      DOWNLOAD_CAPTURE_STATS.playurlFetchResponses += 1;
      return Promise.resolve(result).then((response) => {
        try {
          response.clone().text().then((text) => {
            const payload = parseDownloadPayload(text);
            if (payload) cacheDownloadPlayinfo(payload, "download-fetch", requestUrl);
            else DOWNLOAD_CAPTURE_STATS.lastResult = "playurl-invalid-json";
          }).catch(() => {
            DOWNLOAD_CAPTURE_STATS.lastResult = "playurl-body-unreadable";
          });
        } catch {
          DOWNLOAD_CAPTURE_STATS.lastResult = "playurl-body-unreadable";
        }
        return response;
      });
    });
    const removeXhrHook = networkHooks.addXHR("download-capture", (BaseXHR) => class BiliKitDownloadCaptureXHR extends BaseXHR {
        constructor() {
          super(...arguments);
          this.__bilikitDownloadUrl = "";
          this.addEventListener("loadend", () => {
            if (!enabled || !isDownloadPlayurlUrl(this.__bilikitDownloadUrl) || this.status >= 400) return;
            DOWNLOAD_CAPTURE_STATS.playurlXhrResponses += 1;
            try {
              const raw = this.responseType === "json" ? this.response : this.responseText;
              const payload = parseDownloadPayload(raw);
              if (payload) cacheDownloadPlayinfo(payload, "download-xhr", this.__bilikitDownloadUrl);
              else DOWNLOAD_CAPTURE_STATS.lastResult = "playurl-invalid-json";
            } catch {
              DOWNLOAD_CAPTURE_STATS.lastResult = "playurl-body-unreadable";
            }
          });
        }
        open(method, requestUrl, ...rest) {
          this.__bilikitDownloadUrl = String(requestUrl || "");
          return super.open(method, requestUrl, ...rest);
        }
      });
    const onPlayerMetadata = () => {
      if (!enabled) return;
      publishDownloadSnapshotIfReady();
    };
    document.addEventListener("loadedmetadata", onPlayerMetadata, true);
    document.addEventListener("durationchange", onPlayerMetadata, true);
    const checkDownloadRoute = () => {
      if (!enabled) return;
      queueMicrotask(() => {
        if (isPlayPage()) syncDownloadPageIdentity("url-changed");
        else if (DOWNLOAD_PAGE_ROUTE_KEY) {
          cancelDownloadBatch("离开播放页");
          cancelDownloadActiveFetch("离开播放页");
          closeDownloadWorkspaceForNavigation("left-play-page");
          clearDownloadPlayinfoCache("left-play-page");
          DOWNLOAD_PAGE_ROUTE_KEY = "";
          DOWNLOAD_ACTIVE_FETCH_ROUTE_KEY = "";
          DOWNLOAD_ACTIVE_FETCH_ATTEMPTS = 0;
          DOWNLOAD_CAPTURE_STATS.lastUrlVideoId = "";
          DOWNLOAD_CAPTURE_STATS.lastRouteKey = "";
          DOWNLOAD_CAPTURE_STATS.lastResult = "not-play-page";
        }
      });
    };
    const removePushStateHook = networkHooks.addHistory("download-capture", "pushState", (next) => function (...args) {
      const result = next.apply(this, args);
      checkDownloadRoute();
      return result;
    });
    const removeReplaceStateHook = networkHooks.addHistory("download-capture", "replaceState", (next) => function (...args) {
      const result = next.apply(this, args);
      checkDownloadRoute();
      return result;
    });
    const removePopstateListener = runtime.listen(window, "popstate", checkDownloadRoute);
    const removeHashchangeListener = runtime.listen(window, "hashchange", checkDownloadRoute);
    const disable = () => {
      enabled = false;
      cancelDownloadActiveFetch("下载工作台模块已关闭");
      cancelDownloadBatch("下载工作台模块已关闭");
      closeDownloadWorkspaceForNavigation("download-module-disabled");
    };
    // 关闭模块时移除此 owner 的钩子；网络管理器会重建剩余模块的包装链。
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      disable();
      cancelDownloadActiveFetch("页面已卸载");
      removeFetchHook();
      removeXhrHook();
      removePushStateHook();
      removeReplaceStateHook();
      removePopstateListener();
      removeHashchangeListener();
      document.removeEventListener("loadedmetadata", onPlayerMetadata, true);
      document.removeEventListener("durationchange", onPlayerMetadata, true);
      if (window.__BILIKIT_DOWNLOAD_CAPTURE__) delete window.__BILIKIT_DOWNLOAD_CAPTURE__;
      DOWNLOAD_CAPTURE_STATS.hookInstalled = false;
      DOWNLOAD_CAPTURE_CONTROLLER = null;
      untrackRuntimeCleanup();
    };
    DOWNLOAD_CAPTURE_CONTROLLER = {
      enable: () => { enabled = true; },
      disable,
      destroy
    };
    untrackRuntimeCleanup = runtime.addCleanup(destroy);
    return destroy;
  }
  function downloadCodecLabel(track) {
    const codec = track.codecs.toLowerCase();
    if (/^(?:avc1|avc|h264)/.test(codec)) return "AVC";
    if (/^(?:hvc1|hev1|hevc)/.test(codec)) return "HEVC";
    if (/^(?:av01|av1)/.test(codec)) return "AV1";
    if (/mp4a|aac/.test(codec)) return "AAC";
    if (/flac/.test(codec)) return "FLAC";
    if (/opus/.test(codec)) return "Opus";
    if (/(?:^|[.\s])(?:ec-3|eac3)(?:$|[.\s])/.test(codec)) return "EAC3";
    if (/(?:^|[.\s])(?:ac-3|ac3)(?:$|[.\s])/.test(codec)) return "AC3";
    return track.codecs || "未知编码";
  }
  function downloadTrackLabel(track) {
    if (track.kind === "audio") {
      const rate = track.bandwidth ? `${Math.round(track.bandwidth / 1000)} kbps` : "";
      return [downloadCodecLabel(track), rate].filter(Boolean).join(" · ");
    }
    const size = track.width && track.height ? `${track.width}×${track.height}` : "";
    const fps = track.frameRate ? `${track.frameRate} fps` : "";
    const bitrate = track.bandwidth ? `${(track.bandwidth / 1e6).toFixed(1)} Mbps` : "";
    return [track.qualityLabel, downloadCodecLabel(track), size, fps, bitrate].filter(Boolean).join(" · ");
  }
  function canRemuxDownload(video, audio) {
    return !!video && !!audio && /^video\/mp4(?:;|$)/i.test(video.mimeType) && /^audio\/mp4(?:;|$)/i.test(audio.mimeType) &&
      /^(?:avc1|avc|h264|hvc1|hev1|hevc|av01|av1)/i.test(video.codecs) && /^(?:mp4a|aac)/i.test(audio.codecs);
  }
  function cleanDownloadName(value, maxLength = 72) {
    const cleaned = String(value || "bilibili_video")
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}_]+/gu, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return Array.from(cleaned).slice(0, maxLength).join("") || "bilibili_video";
  }
  function downloadFilenameTitle(model) {
    const raw = String(model?.filenameTitle || model?.collectionRootTitle || model?.title || "");
    const page = Math.max(1, Math.floor(Number(model?.page) || 1));
    if (!raw) return cleanDownloadName(raw);
    const pagePrefix = new RegExp(`^(?:P\\s*0*${page}|第\\s*0*${page}\\s*[P集期])(?=\\s|[_\\-:：]|$)[\\s_\\-:：]*`, "i");
    return cleanDownloadName(raw.replace(pagePrefix, ""));
  }
  function downloadFilenameIdentity(model) {
    const bvid = String(model?.bvid || model?.videoId || "").match(/^BV([0-9A-Za-z]+)$/i);
    if (bvid) return `BV${bvid[1]}`;
    const av = String(model?.videoId || model?.aid || "").match(/^(?:av)?(\d+)$/i);
    return av ? `AV${av[1]}` : "video";
  }
  function downloadFilenamePage(model) {
    if (model?.downloadScope === "bangumi") {
      if (model?.multiSeason) {
        return `S${String(Math.max(1, Number(model?.seasonIndex) || 1)).padStart(2, "0")}E${String(Math.max(1, Number(model?.episodeIndex) || 1)).padStart(2, "0")}`;
      }
      return `E${String(Math.max(1, Number(model?.episodeIndex) || 1)).padStart(2, "0")}`;
    }
    const collectionIndex = Math.max(0, Math.floor(Number(model?.collectionIndex) || 0));
    if (collectionIndex > 0) {
      const collection = `C${String(collectionIndex).padStart(2, "0")}`;
      const pageCount = Math.max(1, Number(model?.collectionPageCount) || 1);
      return pageCount > 1 ? `${collection}_P${String(Math.max(1, Number(model?.page) || 1)).padStart(2, "0")}` : collection;
    }
    const page = Math.max(1, Math.floor(Number(model?.page) || 1));
    return `P${String(page).padStart(2, "0")}`;
  }
  function downloadFilenameQuality(track) {
    if (!track) return "";
    const raw = String(track.qualityLabel || "");
    const numeric = raw.match(/(?:^|[^\d])(\d{3,4})\s*[pP](?:$|[^\w])/);
    const named = raw.match(/(?:^|[^\w])(8K|4K|2K|HDR)(?:$|[^\w])/i);
    const label = numeric ? `${numeric[1]}P` : named ? named[1].toUpperCase() : raw || (track.height ? `${track.height}P` : "");
    return cleanDownloadName(label, 32);
  }
  function downloadFilenameVideoTokens(track) {
    if (!track) return [];
    return [downloadFilenameQuality(track), cleanDownloadName(downloadCodecLabel(track), 20)].filter(Boolean);
  }
  function downloadFilenameAudioTokens(track, includeBitrate = true) {
    if (!track) return [];
    const rate = Number(track.bandwidth) > 0 ? `${Math.round(Number(track.bandwidth) / 1000)}kbps` : "";
    return [cleanDownloadName(downloadCodecLabel(track), 20), includeBitrate ? rate : ""].filter(Boolean);
  }
  function buildDownloadFileName(model, kind, video = null, audio = null) {
    const parts = [
      downloadFilenameTitle(model),
      downloadFilenameIdentity(model || {}),
      downloadFilenamePage(model || {})
    ];
    if (kind === "merge" || kind === "tracks" || kind === "video") parts.push(...downloadFilenameVideoTokens(video));
    if (kind === "merge" || kind === "tracks" || kind === "audio") parts.push(...downloadFilenameAudioTokens(audio, kind !== "merge"));
    const suffix = kind === "merge" || kind === "tracks" && video && audio
      ? "video_audio"
      : kind === "video" || kind === "tracks" && video
        ? "video"
        : "audio";
    parts.push(suffix);
    const base = parts.map((part) => cleanDownloadName(part, 72)).filter(Boolean).join("_");
    const extension = kind === "merge" ? "mp4" : kind === "tracks" ? "" : downloadExtension(kind === "video" ? video : audio);
    return extension ? `${base}.${extension}` : base;
  }
  function buildDownloadTaskTitle(model, kind, video = null, audio = null) {
    return buildDownloadFileName(model, kind, video, audio).replace(/\.[^.]+$/, "");
  }
  function updateDownloadTask(task, patch) {
    Object.assign(task, patch);
    normalizeDownloadTaskProgress(task);
    collectDownloadProgressStats();
    ensureDownloadProgressTimer();
    if (["complete", "partial", "error", "canceled", "ready-to-save"].includes(task.status) && !task.completionSettled) {
      task.completionSettled = true;
      task.resolveCompletion?.(task);
    }
    if (DOWNLOAD_WORKSPACE_ROOT?.isConnected) requestAnimationFrame(renderDownloadTasks);
  }
  function makeDownloadTask(mode, title) {
    const task = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      mode,
      title,
      status: "queued",
      message: "等待开始",
      progress: 0,
      downloadProgress: 0,
      remuxProgress: mode === "merge" ? 0 : 1,
      saveProgress: 0,
      overallProgress: 0,
      loadedBytes: 0,
      totalBytes: 0,
      estimatedBytes: 0,
      fileSizeEstimateBytes: 0,
      downloadStartedAt: 0,
      remuxStartedAt: 0,
      saveStartedAt: 0,
      inputBytes: 0,
      mediaDuration: 0,
      qualityHeight: 0,
      _downloadParts: [],
      blob: null,
      cancelFunctions: [],
      completionSettled: false,
      donePromise: null,
      resolveCompletion: null
    };
    task.donePromise = new Promise((resolve) => { task.resolveCompletion = resolve; });
    DOWNLOAD_TASKS.unshift(task);
    renderDownloadTasks();
    return task;
  }
  function removeDownloadCancel(task, cancel) {
    const index = task.cancelFunctions.indexOf(cancel);
    if (index >= 0) task.cancelFunctions.splice(index, 1);
  }
  function cancelDownloadTask(task) {
    if (!["queued", "downloading", "remuxing", "saving"].includes(task.status)) return;
    task.status = "canceled";
    task.message = "已取消";
    task.blob = null;
    for (const cancel of task.cancelFunctions.splice(0)) {
      try { cancel(); } catch {}
    }
    updateDownloadTask(task, {});
    for (let index = DOWNLOAD_MERGE_QUEUE.length - 1; index >= 0; index--) {
      if (DOWNLOAD_MERGE_QUEUE[index].task === task) DOWNLOAD_MERGE_QUEUE.splice(index, 1);
    }
    mergeDownloadStats();
    pumpMergeDownloadQueue();
  }
  function downloadResponseHeader(response, name) {
    const headerLine = String(response?.responseHeaders || "").match(new RegExp(`^\\s*${name}\\s*:\\s*(.*?)\\s*$`, "im"));
    return headerLine?.[1] || "";
  }
  function isCompleteDownloadResponse(response) {
    const body = response?.response;
    if (!(body instanceof ArrayBuffer) || body.byteLength === 0) return false;
    const status = Number(response.status) || 0;
    const contentLength = Number(downloadResponseHeader(response, "content-length")) || 0;
    const contentRange = downloadResponseHeader(response, "content-range").match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/i);
    if (status === 200) {
      if (!contentRange) return !contentLength || contentLength === body.byteLength;
      const start = Number(contentRange[1]);
      const end = Number(contentRange[2]);
      const total = Number(contentRange[3]);
      return start === 0 && end + 1 === total && total === body.byteLength && (!contentLength || contentLength === body.byteLength);
    }
    if (status !== 206 || !contentRange) return false;
    const start = Number(contentRange[1]);
    const end = Number(contentRange[2]);
    const total = Number(contentRange[3]);
    return start === 0 && end + 1 === total && total === body.byteLength && (!contentLength || contentLength === body.byteLength);
  }
  function probeDownloadResourceSize(url, task) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("无法验证下载资源完整性：Tampermonkey 请求 API 不可用"));
        return;
      }
      let request;
      let settled = false;
      const cancel = () => {
        if (settled) return;
        settled = true;
        request?.abort();
        reject(new Error("已取消"));
      };
      const finish = (error, size) => {
        if (settled) return;
        settled = true;
        removeDownloadCancel(task, cancel);
        request?.abort();
        if (error) reject(error);
        else resolve(size);
      };
      const inspectHeaders = (response) => {
        if (settled || Number(response.readyState) < 2) return;
        const status = Number(response.status) || 0;
        const contentLength = Number(downloadResponseHeader(response, "content-length")) || 0;
        const contentRange = downloadResponseHeader(response, "content-range").match(/^bytes\s+0-\d+\/(\d+)$/i);
        const size = status === 206 ? Number(contentRange?.[1]) || 0 : status === 200 ? Number(contentRange?.[1]) || contentLength : 0;
        if (size > 0) finish(null, size);
        else finish(new Error(status === 403 ? "媒体资源拒绝访问或签名已过期" : "CDN 未提供可验证的完整轨道长度"));
      };
      try {
        request = GM_xmlhttpRequest({
          method: "GET",
          url,
          responseType: "arraybuffer",
          timeout: 15000,
          headers: downloadMediaHeaders({ Range: "bytes=0-0" }),
          onreadystatechange: inspectHeaders,
          onload: inspectHeaders,
          onerror: () => finish(new Error("无法验证媒体资源长度")),
          ontimeout: () => finish(new Error("验证媒体资源长度超时")),
          onabort: () => {
            if (!settled && task.status === "canceled") finish(new Error("已取消"));
          }
        });
        task.cancelFunctions.push(cancel);
      } catch {
        finish(new Error("无法验证媒体资源长度"));
      }
    });
  }
  function taskStatusLabel(task) {
    return ({ queued: "等待中", downloading: "下载中", remuxing: "封装中", saving: "保存中", complete: "已完成", partial: "部分完成", error: "失败", canceled: "已取消", "ready-to-save": "等待保存" })[task.status] || task.status;
  }
  function renderDownloadTasks() {
    const list = DOWNLOAD_WORKSPACE_ROOT?.querySelector("[data-bk-download-tasks]");
    if (!list) return;
    collectDownloadProgressStats();
    renderDownloadOverview();
    list.replaceChildren();
    if (!DOWNLOAD_TASKS.length) {
      const empty = document.createElement("p");
      empty.className = "bk-dw-empty";
      empty.textContent = "下载任务会显示在这里；任务记录只保留在当前页面内存中。";
      list.appendChild(empty);
      return;
    }
    const visibleTasks = DOWNLOAD_TASKS.slice(0, DOWNLOAD_TASK_VISIBLE_LIMIT);
    for (const task of visibleTasks) {
      const card = document.createElement("article");
      card.className = "bk-dw-task";
      const head = document.createElement("div");
      head.className = "bk-dw-task-head";
      const title = document.createElement("strong");
      title.textContent = task.title;
      const status = document.createElement("span");
      status.className = `bk-dw-status ${task.status}`;
      status.textContent = taskStatusLabel(task);
      head.append(title, status);
      card.appendChild(head);
      const detail = document.createElement("p");
      detail.className = "bk-dw-task-detail";
      detail.textContent = task.message;
      card.appendChild(detail);
      if (downloadWorkspaceSetting("showFileSize")) {
        const size = document.createElement("div");
        size.className = "bk-dw-task-size";
        const loaded = formatDownloadBytes(task.loadedBytes);
        const total = task.totalBytes || task.fileSizeEstimateBytes || task.estimatedBytes;
        size.textContent = total ? `文件大小：${loaded} / ${formatDownloadBytes(total)}` : "文件大小：估算中";
        card.appendChild(size);
      }
      if (downloadWorkspaceSetting("showTaskProgress")) {
        const metrics = document.createElement("div");
        metrics.className = "bk-dw-task-metrics";
        const downloadMetric = document.createElement("span");
        downloadMetric.className = "bk-dw-task-metric";
        downloadMetric.textContent = `下载 ${Math.round(downloadClamp(task.downloadProgress) * 100)}%`;
        const remuxMetric = document.createElement("span");
        remuxMetric.className = "bk-dw-task-metric";
        remuxMetric.textContent = downloadTaskNeedsRemux(task) ? `转码 ${Math.round(downloadClamp(task.remuxProgress) * 100)}%` : "转码 无需转码";
        const overallMetric = document.createElement("span");
        overallMetric.className = "bk-dw-task-metric";
        overallMetric.textContent = `总计 ${Math.round(downloadClamp(task.overallProgress) * 100)}%`;
        metrics.append(downloadMetric, remuxMetric, overallMetric);
        card.appendChild(metrics);
      }
      if (["queued", "downloading", "remuxing", "saving"].includes(task.status)) {
        const progressRow = document.createElement("div");
        progressRow.className = "bk-dw-task-progress-row";
        const progress = document.createElement("progress");
        progress.max = 100;
        progress.value = Math.round(downloadClamp(task.overallProgress) * 100);
        const progressValue = document.createElement("span");
        progressValue.className = "bk-dw-task-progress-value";
        progressValue.textContent = `${Math.round(downloadClamp(task.overallProgress) * 100)}%`;
        progressRow.append(progress, progressValue);
        card.appendChild(progressRow);
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "bk-dw-task-action";
        cancel.textContent = "取消";
        cancel.addEventListener("click", () => cancelDownloadTask(task));
        card.appendChild(cancel);
      }
      if (task.status === "ready-to-save" && task.blob) {
        const save = document.createElement("button");
        save.type = "button";
        save.className = "bk-dw-task-action primary";
        save.textContent = "保存 MP4";
        save.addEventListener("click", () => saveMergedDownload(task, true));
        card.appendChild(save);
      }
      if (task.status === "error" && typeof task.retry === "function") {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "bk-dw-task-action";
        retry.textContent = `重试此${task.batchScope === "collection" ? " C" : task.batchScope === "bangumi" ? " E" : " P"}`;
        retry.addEventListener("click", () => task.retry());
        card.appendChild(retry);
      }
      list.appendChild(card);
    }
    if (DOWNLOAD_TASKS.length > visibleTasks.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "bk-dw-task-action";
      more.textContent = `再显示 ${Math.min(DOWNLOAD_TASK_DISPLAY_LIMIT, DOWNLOAD_TASKS.length - visibleTasks.length)} 项（剩余 ${DOWNLOAD_TASKS.length - visibleTasks.length} 项）`;
      more.addEventListener("click", () => {
        DOWNLOAD_TASK_VISIBLE_LIMIT += DOWNLOAD_TASK_DISPLAY_LIMIT;
        renderDownloadTasks();
      });
      list.appendChild(more);
    }
  }
  function saveMergedBlobWithBrowser(task) {
    if (!task.blob) return false;
    const fileName = task.fileName || "bilibili_video.mp4";
    const url = URL.createObjectURL(task.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";
    document.body?.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60e3);
    task.blob = null;
    setDownloadSaveProgress(task, 1);
    updateDownloadTask(task, { status: "complete", progress: 100, message: `已交给浏览器保存：${fileName}` });
    return true;
  }
  function saveMergedDownload(task, fromUser) {
    if (!task.blob) return;
    // Edge/Tampermonkey 对 GM_download(blob: URL) 可能忽略 name 并落盘为 UUID。
    // 合并结果改走原生 download 属性，确保脚本生成的文件名真正传给浏览器。
    if (task.mode === "merge") {
      if (!fromUser) {
        setDownloadSaveProgress(task, 0.1);
        updateDownloadTask(task, { status: "saving", progress: 99, message: `正在保存：${task.fileName}` });
      }
      saveMergedBlobWithBrowser(task);
      return;
    }
    if (fromUser || typeof GM_download !== "function") {
      if (!fromUser) {
        updateDownloadTask(task, { status: "ready-to-save", message: "下载管理器 API 不可用；点击“保存 MP4”由浏览器另存。" });
        return;
      }
      saveMergedBlobWithBrowser(task);
      return;
    }
    const objectUrl = URL.createObjectURL(task.blob);
    setDownloadSaveProgress(task, 0.1);
    updateDownloadTask(task, { status: "saving", progress: 99, message: "正在交给浏览器下载管理器…" });
    let settled = false;
    let request;
    const revoke = () => URL.revokeObjectURL(objectUrl);
    const cancel = () => {
      try { request?.abort(); } finally { revoke(); }
    };
    task.cancelFunctions.push(cancel);
    const fail = () => {
      if (settled) return;
      settled = true;
      removeDownloadCancel(task, cancel);
      revoke();
      if (task.status === "canceled") return;
      updateDownloadTask(task, { status: "ready-to-save", progress: 99, message: "管理器没有接受 Blob 下载；可点击“保存 MP4”重试。" });
    };
    try {
      request = GM_download({
        url: objectUrl,
        name: task.fileName,
        saveAs: false,
        onprogress: (event) => {
          if (event.lengthComputable && event.total) setDownloadSaveProgress(task, event.loaded / event.total);
        },
        onload: () => {
          if (settled) return;
          settled = true;
          removeDownloadCancel(task, cancel);
          revoke();
          task.blob = null;
          setDownloadSaveProgress(task, 1);
          updateDownloadTask(task, { status: "complete", progress: 100, message: `已下载：${task.fileName}` });
        },
        onerror: fail,
        ontimeout: fail
      });
    } catch {
      fail();
    }
  }
  function gmRequestArrayBuffer(track, task, onProgress, requestedPartIndex = -1) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("Tampermonkey 跨域请求 API 不可用"));
        return;
      }
      const urls = track.urls.slice(0, 3);
      let index = 0;
      let lastStatus = 0;
      let lastFailure = "";
      const partIndex = requestedPartIndex >= 0 ? requestedPartIndex : task._downloadParts.length;
      if (!task._downloadParts[partIndex]) {
        task._downloadParts[partIndex] = { loaded: 0, total: 0, estimated: estimateDownloadTrackBytes(track, task.mediaDuration) };
      }
      const tryNext = () => {
        if (task.status === "canceled") {
          reject(new Error("已取消"));
          return;
        }
        const url = urls[index++];
        if (!url) {
          if (lastFailure) {
            reject(new Error(lastFailure));
            return;
          }
          const message = lastStatus === 403
            ? "媒体资源拒绝访问（签名可能过期或当前账号无权限）"
            : lastStatus === 404
              ? "媒体资源不存在或签名地址已过期"
              : lastStatus
                ? `媒体资源请求失败（HTTP ${lastStatus}）`
                : "媒体资源请求失败（网络或权限不可用）";
          reject(new Error(message));
          return;
        }
        let request;
        const cancel = () => request?.abort();
        const finish = () => removeDownloadCancel(task, cancel);
        try {
      request = GM_xmlhttpRequest({
            method: "GET",
            url,
            responseType: "arraybuffer",
            timeout: 15 * 60 * 1000,
            headers: downloadMediaHeaders(),
            onprogress: (event) => {
              updateDownloadPartProgress(task, partIndex, event.loaded, event.lengthComputable ? event.total : 0);
              onProgress(event);
            },
            onload: (response) => {
              finish();
              lastStatus = Number(response.status) || lastStatus;
              if (isCompleteDownloadResponse(response)) {
                const bodyBytes = response.response instanceof ArrayBuffer ? response.response.byteLength : 0;
                if (bodyBytes) {
                  updateDownloadPartProgress(task, partIndex, bodyBytes, bodyBytes);
                  onProgress({ loaded: bodyBytes, total: bodyBytes, lengthComputable: true });
                }
                resolve(response.response);
              } else {
                lastFailure = Number(response.status) === 206
                  ? "媒体资源返回了不完整的 206 分段，已阻止错误封装"
                  : response.response instanceof ArrayBuffer && response.response.byteLength
                    ? "媒体资源长度与响应声明不一致，已阻止错误封装"
                    : "媒体资源响应不完整，已阻止错误封装";
                resetDownloadPartProgress(task, partIndex);
                tryNext();
              }
            },
            onerror: () => { finish(); resetDownloadPartProgress(task, partIndex); tryNext(); },
            ontimeout: () => { finish(); resetDownloadPartProgress(task, partIndex); tryNext(); },
            onabort: () => { finish(); reject(new Error("已取消")); }
          });
          task.cancelFunctions.push(cancel);
        } catch {
          finish();
          resetDownloadPartProgress(task, partIndex);
          tryNext();
        }
      };
      tryNext();
    });
  }
  function gmDownloadTrack(track, fileName, task, onProgress, partIndex = -1) {
    return new Promise((resolve, reject) => {
      if (typeof GM_download !== "function") {
        reject(new Error("Tampermonkey 下载 API 不可用"));
        return;
      }
      const urls = track.urls.slice(0, 3);
      let index = 0;
      let lastFailure = "";
      const tryNext = async () => {
        if (task.status === "canceled") {
          reject(new Error("已取消"));
          return;
        }
        const url = urls[index++];
        if (!url) {
          reject(new Error(lastFailure || "下载失败；没有可验证完整性的媒体地址"));
          return;
        }
        let expectedBytes = 0;
        try {
          expectedBytes = await probeDownloadResourceSize(url, task);
          if (partIndex >= 0 && task._downloadParts[partIndex]) {
            task._downloadParts[partIndex].total = expectedBytes;
            task._downloadParts[partIndex].estimated = expectedBytes;
            normalizeDownloadTaskProgress(task);
          }
        } catch (error) {
          if (task.status === "canceled") {
            reject(new Error("已取消"));
            return;
          }
          lastFailure = error instanceof Error ? error.message : "无法验证媒体资源长度";
          resetDownloadPartProgress(task, partIndex);
          void tryNext();
          return;
        }
        if (task.status === "canceled") {
          reject(new Error("已取消"));
          return;
        }
        let request;
        let lastLoaded = 0;
        let abortReason = "";
        const cancel = () => request?.abort();
        const finish = () => removeDownloadCancel(task, cancel);
        try {
          request = GM_download({
            url,
            name: fileName,
            saveAs: false,
            headers: downloadMediaHeaders(),
            onprogress: (event) => {
              lastLoaded = Math.max(lastLoaded, Number(event.loaded) || 0);
              onProgress(event);
              if (event.lengthComputable && Number(event.total) !== expectedBytes) {
                abortReason = "下载响应长度与已探测资源不符";
                request?.abort();
              }
            },
            onload: () => {
              finish();
              if (expectedBytes > 0) {
                lastLoaded = expectedBytes;
                onProgress({ loaded: expectedBytes, total: expectedBytes, lengthComputable: true });
              }
              if (lastLoaded !== expectedBytes) {
                reject(new Error(`下载字节数不完整（${lastLoaded}/${expectedBytes}），请删除不完整文件后重试`));
                return;
              }
              resolve(fileName);
            },
            onerror: () => { finish(); resetDownloadPartProgress(task, partIndex); lastFailure = "媒体轨下载失败"; void tryNext(); },
            ontimeout: () => { finish(); resetDownloadPartProgress(task, partIndex); lastFailure = "媒体轨下载超时"; void tryNext(); },
            onabort: () => {
              finish();
              if (task.status === "canceled") reject(new Error("已取消"));
              else if (abortReason) reject(new Error(`${abortReason}；已中止该轨道`));
              else reject(new Error("下载中止"));
            }
          });
          task.cancelFunctions.push(cancel);
        } catch {
          finish();
          resetDownloadPartProgress(task, partIndex);
          tryNext();
        }
      };
      tryNext();
    });
  }
  function downloadExtension(track) {
    if (track.kind === "video") return "mp4";
    const mime = String(track.mimeType || "").toLowerCase().split(";", 1)[0].trim();
    const codec = String(track.codecs || "").toLowerCase();
    // B 站 DASH 音频通常是 audio/mp4：内容是音频，但容器仍是 ISO-BMFF，
    // 应使用音频 MP4 的 .m4a，而不是视频用的 .mp4，也不能按 codec 伪装成原始 FLAC/EC-3。
    if (mime === "audio/mp4" || mime === "audio/x-m4a") return "m4a";
    if (mime === "audio/flac" || codec.includes("flac")) return "flac";
    if (mime === "audio/ogg" || codec.includes("opus")) return "opus";
    if (mime === "audio/mpeg" || codec.includes("mp3")) return "mp3";
    if (mime === "audio/aac" || /^(?:mp4a|aac)/.test(codec)) return "aac";
    if (mime === "audio/ac3" || mime === "audio/eac3" || /(?:^|[.\s])(?:ec-3|eac3|ac-3)(?:$|[.\s])/.test(codec)) return "ec3";
    return "m4a";
  }
  function runSeparateDownload(model, video, audio, existingTask = null, note = "") {
    const selected = [video, audio].filter(Boolean);
    const taskKind = selected.length > 1 ? "tracks" : video ? "video" : "audio";
    const task = existingTask || makeDownloadTask("tracks", buildDownloadTaskTitle(model, taskKind, video, audio));
    task.title = buildDownloadTaskTitle(model, taskKind, video, audio);
    const progress = selected.map(() => 0);
    const files = selected.map((track) => buildDownloadFileName(
      model,
      track.kind,
      track.kind === "video" ? track : null,
      track.kind === "audio" ? track : null
    ));
    task.status = "downloading";
    task.downloadStartedAt = task.downloadStartedAt || downloadNow();
    task.mediaDuration = Number(model.duration) || 0;
    task.qualityHeight = downloadTrackHeight(video);
    task._downloadParts = selected.map((track) => ({
      loaded: 0,
      total: 0,
      estimated: estimateDownloadTrackBytes(track, model.duration)
    }));
    task.fileSizeEstimateBytes = task._downloadParts.reduce((sum, part) => sum + part.estimated, 0);
    task.message = `${note ? `${note}；` : ""}正在下载 ${selected.length} 条轨道`;
    renderDownloadTasks();
    const remoteGate = task.remoteDownloadGate;
    const remoteController = remoteGate ? new AbortController() : null;
    let releaseRemote = null;
    let cancelRemote = null;
    const run = async () => {
      try {
        if (remoteGate) {
          cancelRemote = () => remoteController.abort("任务已取消");
          task.cancelFunctions.push(cancelRemote);
          releaseRemote = await remoteGate.acquire(remoteController.signal);
          removeDownloadCancel(task, cancelRemote);
          cancelRemote = null;
          if (task.status === "canceled") return;
        }
        const jobs = selected.map((track, index) => gmDownloadTrack(track, files[index], task, (event) => {
          if (event.lengthComputable && event.total) progress[index] = event.loaded / event.total;
          updateDownloadPartProgress(task, index, event.loaded, event.lengthComputable ? event.total : task._downloadParts[index]?.estimated || 0);
          task.saveProgress = task.downloadProgress;
          task.overallProgress = task.downloadProgress * 0.95 + task.saveProgress * 0.05;
          task.message = selected.map((item, i) => `${item.kind === "video" ? "视频" : "音频"} ${Math.round(progress[i] * 100)}%`).join(" · ");
          updateDownloadTask(task, {});
        }, index));
        const results = await Promise.allSettled(jobs);
        if (task.status === "canceled") return;
        const success = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
        const failed = results.filter((result) => result.status === "rejected");
        const errors = failed.length;
        const failureMessage = failed
          .map((result) => result.reason instanceof Error ? result.reason.message : "下载失败")
          .map((message) => message.replace(/https?:\/\/\S+/gi, "媒体资源").replace(/[?&](?:[a-z0-9_]+)=\S+/gi, "[签名参数]").slice(0, 180))
          .filter(Boolean)
          .join("；");
        const state = errors === 0 ? "complete" : success.length ? "partial" : "error";
        updateDownloadTask(task, {
          status: state,
          downloadProgress: state === "complete" ? 1 : task.downloadProgress,
          saveProgress: state === "complete" ? 1 : task.saveProgress,
          progress: state === "complete" ? 100 : task.progress,
          message: success.length
            ? `已提交 ${success.length} 个文件${errors ? `，${errors} 个失败：${failureMessage || "资源不可用"}` : ""}：${success.join("、")}`
            : failureMessage || "下载失败；地址可能过期、没有权限或网络不可用。"
        });
      } catch (error) {
        if (task.status !== "canceled") runDownloadTaskError(task, error);
      } finally {
        if (cancelRemote) removeDownloadCancel(task, cancelRemote);
        releaseRemote?.();
        releaseRemote = null;
      }
    };
    void run();
  }
  function mergeDownloadStats() {
    DOWNLOAD_CAPTURE_STATS.mergeQueued = DOWNLOAD_MERGE_QUEUE.length;
    DOWNLOAD_CAPTURE_STATS.mergeRunning = DOWNLOAD_MERGE_RUNNING;
  }
  function runDownloadTaskError(task, error) {
    if (!task || task.status === "canceled") return;
    const reason = error instanceof Error ? error.message : "任务失败";
    updateDownloadTask(task, {
      status: "error",
      message: reason.replace(/https?:\/\/\S+/gi, "媒体资源").replace(/[?&](?:[a-z0-9_]+)=\S+/gi, "[签名参数]").slice(0, 220)
    });
  }
  function enqueueMergeDownload(model, video, audio, existingTask = null, note = "") {
    const task = existingTask || makeDownloadTask("merge", buildDownloadTaskTitle(model, "merge", video, audio));
    task.title = buildDownloadTaskTitle(model, "merge", video, audio);
    task.estimatedBytes = estimateDownloadMemoryBytes({ duration: model.duration, videos: [video], audios: [audio] });
    task.fileSizeEstimateBytes = estimateDownloadTrackBytes(video, model.duration) + estimateDownloadTrackBytes(audio, model.duration);
    task.mediaDuration = Number(model.duration) || 0;
    task.qualityHeight = downloadTrackHeight(video);
    task.mergeNote = note;
    DOWNLOAD_MERGE_QUEUE.push({ model, video, audio, task });
    mergeDownloadStats();
    pumpMergeDownloadQueue();
    return task;
  }
  function pumpMergeDownloadQueue() {
    const queuedJobs = DOWNLOAD_MERGE_QUEUE.filter((job) => job.task.status !== "canceled");
    const workloadJobs = [...DOWNLOAD_MERGE_RUNNING_JOBS, ...queuedJobs];
    const largestJob = workloadJobs.reduce((largest, job) => {
      const estimate = Number(job.task.estimatedBytes) || 0;
      return estimate > (largest?.task?.estimatedBytes || 0) ? job : largest;
    }, null);
    const maxDuration = workloadJobs.reduce((value, job) => Math.max(value, Number(job.model?.duration) || 0), 0);
    const maxBitrate = workloadJobs.reduce((value, job) => {
      const video = Number(job.video?.bandwidth) || 0;
      const audio = Number(job.audio?.bandwidth) || 0;
      return Math.max(value, video + audio);
    }, 0);
    const maxQualityHeight = workloadJobs.reduce((value, job) => Math.max(value, downloadTrackHeight(job.video)), 0);
    const budget = calculateDownloadMergeBudget({
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      heapLimitBytes: performance.memory?.jsHeapSizeLimit,
      largestEstimateBytes: largestJob?.task?.estimatedBytes || 0,
      maxDuration,
      maxBitrate,
      maxQualityHeight
    });
    DOWNLOAD_CAPTURE_STATS.memoryBudgetBytes = budget.memoryBudgetBytes;
    DOWNLOAD_CAPTURE_STATS.effectiveMergeConcurrency = budget.concurrency;
    while (DOWNLOAD_MERGE_QUEUE.length && DOWNLOAD_MERGE_RUNNING < budget.concurrency) {
      for (let index = DOWNLOAD_MERGE_QUEUE.length - 1; index >= 0; index--) {
        if (DOWNLOAD_MERGE_QUEUE[index].task.status === "canceled") DOWNLOAD_MERGE_QUEUE.splice(index, 1);
      }
      if (!DOWNLOAD_MERGE_QUEUE.length) break;
      const index = DOWNLOAD_MERGE_QUEUE.findIndex((job) => {
        const bytes = Number(job.task.estimatedBytes) || 0;
        return DOWNLOAD_MERGE_RUNNING === 0 || DOWNLOAD_MERGE_RUNNING_BYTES + bytes <= budget.memoryBudgetBytes;
      });
      if (index < 0) break;
      const [job] = DOWNLOAD_MERGE_QUEUE.splice(index, 1);
      const estimated = Number(job.task.estimatedBytes) || 0;
      DOWNLOAD_MERGE_RUNNING += 1;
      DOWNLOAD_MERGE_RUNNING_BYTES += estimated;
      DOWNLOAD_MERGE_RUNNING_JOBS.add(job);
      job.task.status = "queued";
      job.task.message = `${job.task.mergeNote ? `${job.task.mergeNote}；` : ""}等待合并任务槽（预计占用 ${(estimated / 1048576).toFixed(0)} MiB）`;
      updateDownloadTask(job.task, {});
      void runMergeDownload(job.model, job.video, job.audio, job.task).finally(() => {
        DOWNLOAD_MERGE_RUNNING = Math.max(0, DOWNLOAD_MERGE_RUNNING - 1);
        DOWNLOAD_MERGE_RUNNING_BYTES = Math.max(0, DOWNLOAD_MERGE_RUNNING_BYTES - estimated);
        DOWNLOAD_MERGE_RUNNING_JOBS.delete(job);
        mergeDownloadStats();
        pumpMergeDownloadQueue();
      });
    }
    mergeDownloadStats();
  }
  async function runMergeDownload(model, video, audio, existingTask = null) {
    const task = existingTask || makeDownloadTask("merge", buildDownloadTaskTitle(model, "merge", video, audio));
    if (task.status === "canceled") return;
    task.title = buildDownloadTaskTitle(model, "merge", video, audio);
    task.fileName = buildDownloadFileName(model, "merge", video, audio);
    let worker = null;
    let workerUrl = "";
    let cancelWorker = null;
    const remoteGate = task.remoteDownloadGate;
    const remoteController = remoteGate ? new AbortController() : null;
    let releaseRemote = null;
    let cancelRemote = null;
    try {
      if (!canRemuxDownload(video, audio)) throw new Error("当前编码无法直通封装；可尝试分轨下载");
      if (remoteGate) {
        cancelRemote = () => remoteController.abort("任务已取消");
        task.cancelFunctions.push(cancelRemote);
        releaseRemote = await remoteGate.acquire(remoteController.signal);
        removeDownloadCancel(task, cancelRemote);
        cancelRemote = null;
        if (task.status === "canceled") return;
      }
      task.status = "downloading";
      task.downloadStartedAt = task.downloadStartedAt || downloadNow();
      task.mediaDuration = Number(model.duration) || task.mediaDuration || 0;
      task.qualityHeight = downloadTrackHeight(video);
      task._downloadParts = [
        { loaded: 0, total: 0, estimated: estimateDownloadTrackBytes(video, task.mediaDuration) },
        { loaded: 0, total: 0, estimated: estimateDownloadTrackBytes(audio, task.mediaDuration) }
      ];
      task.fileSizeEstimateBytes = task._downloadParts.reduce((sum, part) => sum + part.estimated, 0);
      task.message = `${task.mergeNote ? `${task.mergeNote}；` : ""}正在通过 B 站原始签名地址读取音视频轨…`;
      updateDownloadTask(task, {});
      const progress = [0, 0];
      const [videoBuffer, audioBuffer] = await Promise.all([
        gmRequestArrayBuffer(video, task, (event) => {
          if (event.lengthComputable && event.total) progress[0] = event.loaded / event.total;
          updateDownloadTask(task, { message: `读取音视频轨：视频 ${Math.round(progress[0] * 100)}% · 音频 ${Math.round(progress[1] * 100)}%` });
        }, 0),
        gmRequestArrayBuffer(audio, task, (event) => {
          if (event.lengthComputable && event.total) progress[1] = event.loaded / event.total;
          updateDownloadTask(task, { message: `读取音视频轨：视频 ${Math.round(progress[0] * 100)}% · 音频 ${Math.round(progress[1] * 100)}%` });
        }, 1)
      ]);
      // 番剧的远程媒体槽只覆盖轨道读取；进入本地 Worker 后释放，
      // 使本地合并池继续按内存预算和最多 4 个并发独立调度。
      releaseRemote?.();
      releaseRemote = null;
      if (task.status === "canceled") return;
      const source = DOWNLOAD_WORKER_SOURCE;
      if (!source) throw new Error("当前脚本未包含 MP4 封装 Worker，请重新构建完整脚本");
      workerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      worker = new Worker(workerUrl);
      task.status = "remuxing";
      task.downloadProgress = 1;
      task.remuxProgress = 0;
      task.remuxStartedAt = downloadNow();
      task.inputBytes = task.loadedBytes || task.fileSizeEstimateBytes;
      task.message = "音视频数据已读取，正在无损重封装 MP4…";
      updateDownloadTask(task, {});
      const revoke = () => { if (workerUrl) URL.revokeObjectURL(workerUrl); workerUrl = ""; };
      const result = await new Promise((resolve, reject) => {
        cancelWorker = () => { worker?.terminate(); revoke(); reject(new Error("已取消")); };
        task.cancelFunctions.push(cancelWorker);
        worker.addEventListener("message", (event) => {
          const message = event.data || {};
          if (message.type === "progress") {
            const fraction = Number(message.fraction) || 0;
            setDownloadRemuxProgress(task, fraction);
            updateDownloadTask(task, { message: `正在重封装${message.track === "video" ? "视频" : "音频"}轨…` });
          } else if (message.type === "done") {
            setDownloadRemuxProgress(task, 1);
            recordDownloadRemuxSample(task, downloadNow() - task.remuxStartedAt);
            resolve(message);
          }
          else if (message.type === "error") reject(new Error(String(message.message || "MP4 封装失败").replace(/https?:\/\/\S+/gi, "媒体资源").slice(0, 220)));
        });
        worker.addEventListener("error", () => reject(new Error("MP4 Worker 执行失败")), { once: true });
        worker.postMessage({ type: "remux", video: videoBuffer, audio: audioBuffer, duration: model.duration, title: model.title }, [videoBuffer, audioBuffer]);
      });
      removeDownloadCancel(task, cancelWorker);
      worker.terminate();
      revoke();
      cancelWorker = null;
      worker = null;
      if (task.status === "canceled") return;
      task.blob = new Blob([result.buffer], { type: "video/mp4" });
      task.status = "saving";
      task.remuxProgress = 1;
      task.inputBytes = task.inputBytes || task.fileSizeEstimateBytes;
      setDownloadSaveProgress(task, 0.1);
      task.message = `封装完成（${(result.bytes / 1048576).toFixed(1)} MiB），正在提交下载…`;
      updateDownloadTask(task, {});
      saveMergedDownload(task, false);
    } catch (error) {
      if (cancelWorker) removeDownloadCancel(task, cancelWorker);
      try { worker?.terminate(); } catch {}
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      if (task.status === "canceled") return;
      runDownloadTaskError(task, error);
    } finally {
      if (cancelRemote) removeDownloadCancel(task, cancelRemote);
      releaseRemote?.();
    }
  }
  function snapshotMatchesDownloadEpisode(snapshot, entry, basePage) {
    if (!snapshot || !entry) return false;
    const snapshotId = normalizedDownloadVideoId(snapshot.videoId || snapshot.bvid);
    const entryId = normalizedDownloadVideoId(entry.videoId || entry.bvid || basePage?.videoId);
    return !!entry.cid && String(snapshot.cid) === String(entry.cid) && (!entryId || downloadVideoIdentityMatches(snapshotId, snapshot.aid, entryId, entry.aid || basePage?.aid));
  }
  function snapshotMatchesDownloadBangumiEpisode(snapshot, entry, basePage) {
    if (!snapshot || !entry || snapshot.downloadScope !== "bangumi") return false;
    if (entry.seasonId && snapshot.seasonId && String(entry.seasonId) !== String(snapshot.seasonId)) return false;
    if (entry.epId && snapshot.epId && String(entry.epId) !== String(snapshot.epId)) return false;
    return snapshotMatchesDownloadEpisode(snapshot, entry, basePage);
  }
  function makeDownloadEpisodePage(entry, basePage) {
    return {
      ...basePage,
      videoId: normalizedDownloadVideoId(entry.videoId || entry.bvid || basePage.videoId),
      bvid: normalizedDownloadBvid(entry.bvid || basePage.bvid || entry.videoId || basePage.videoId),
      aid: normalizedDownloadAid(entry.aid || basePage.aid),
      cid: String(entry.cid || ""),
      page: Math.max(1, Number(entry.page) || 1),
      title: selectDownloadTitle(basePage.title, entry.title) || basePage.title,
      duration: Number(entry.duration) || Number(basePage.duration) || 0,
      routeKey: `${basePage.routeKey || basePage.videoId}|p=${Number(entry.page) || 1}|cid=${entry.cid || "unknown"}`,
      requiresCid: false,
      stateMatchesUrl: true,
      urlVideoId: normalizedDownloadVideoId(entry.videoId || entry.bvid || basePage.videoId)
    };
  }
  function makeDownloadBangumiPage(entry, basePage) {
    const seasonId = String(entry?.seasonId || basePage?.seasonId || "").match(/^\d+$/)?.[0] || "";
    const epId = String(entry?.epId || basePage?.epId || "").match(/^\d+$/)?.[0] || "";
    const episodeIndex = Math.max(1, Number(entry?.episodeIndex) || 1);
    const videoId = normalizedDownloadVideoId(entry?.videoId || entry?.bvid || basePage?.videoId);
    const bvid = normalizedDownloadBvid(entry?.bvid || videoId || basePage?.bvid);
    const aid = normalizedDownloadAid(entry?.aid || String(videoId || "").match(/^av(\d+)$/i)?.[1] || basePage?.aid);
    const filenameTitle = selectDownloadTitle(entry?.filenameTitle, basePage?.filenameTitle, basePage?.seasonTitle, basePage?.title) || "Bilibili 视频";
    return {
      ...basePage,
      downloadScope: "bangumi",
      seasonId,
      seasonIndex: Math.max(1, Number(entry?.seasonIndex) || Number(basePage?.seasonIndex) || 1),
      seasonLabel: entry?.seasonLabel || basePage?.seasonLabel || "",
      epId,
      episodeIndex,
      videoId,
      bvid,
      aid,
      cid: String(entry?.cid || ""),
      page: 1,
      title: selectDownloadTitle(entry?.title, entry?.part, basePage?.title) || basePage?.title || filenameTitle,
      filenameTitle,
      seasonTitle: entry?.seasonTitle || filenameTitle,
      multiSeason: !!entry?.multiSeason || !!basePage?.multiSeason,
      duration: Number(entry?.duration) || Number(basePage?.duration) || 0,
      routeKey: `${basePage?.routeKey || `${location.origin.toLowerCase()}${location.pathname}`}|season=${seasonId || "unknown"}|ep=${epId || "unknown"}|cid=${entry?.cid || "unknown"}`,
      requiresCid: false,
      stateMatchesUrl: true,
      urlVideoId: videoId
    };
  }
  function makeDownloadCollectionPage(entry, basePage) {
    const collectionTitle = selectDownloadTitle(basePage?.filenameTitle, basePage?.collectionTitle, basePage?.title) || basePage?.title || "Bilibili 视频";
    const entryTitle = selectDownloadTitle(entry?.title, entry?.part, basePage?.title) || collectionTitle;
    return {
      ...basePage,
      videoId: normalizedDownloadVideoId(entry.videoId || entry.bvid),
      bvid: normalizedDownloadBvid(entry.bvid || entry.videoId),
      aid: normalizedDownloadAid(entry.aid),
      cid: String(entry.cid || ""),
      page: Math.max(1, Number(entry.page) || 1),
      collectionIndex: Math.max(1, Number(entry.collectionIndex) || 1),
      collectionPageCount: Math.max(1, Number(entry.collectionPageCount) || 1),
      collectionLabel: downloadVideoListLabel(entry),
      // 合集主标题与单个条目标题分开保存：条目标题用于当前 BV 的页面、任务
      // 和文件名，主标题仅作为合集上下文保留。不能读取不存在的 entry.videoTitle，
      // 否则所有合集条目都会退回当前页面标题。
      collectionTitle,
      collectionItemTitle: entryTitle,
      collectionRootTitle: collectionTitle,
      // 合集文件名使用该条目自己的标题，避免从 C03 打开后 C01/C02
      // 全部带上 C03 的标题；公共合集标题仍保留在 collectionTitle。
      filenameTitle: entryTitle,
      title: entryTitle,
      downloadScope: "collection",
      duration: Number(entry.duration) || 0,
      routeKey: `${basePage.routeKey || basePage.videoId}|collection=${entry.bvid || entry.videoId}|cid=${entry.cid || "unknown"}`,
      requiresCid: false,
      stateMatchesUrl: true,
      urlVideoId: normalizedDownloadVideoId(entry.videoId || entry.bvid)
    };
  }
  async function resolveDownloadCollectionPage(entry, basePage, signal, viewCache = null, viewControllers = null) {
    const page = makeDownloadCollectionPage(entry, basePage);
    if (!page.videoId) throw new Error(`视频列表 ${page.collectionLabel || `C${String(page.collectionIndex).padStart(2, "0")}`} 缺少视频 ID`);
    const cacheKey = normalizedDownloadVideoId(page.videoId || page.bvid || page.aid);
    let viewPromise = viewCache?.get(cacheKey);
    if (!viewPromise) {
      const requestController = viewCache ? new AbortController() : null;
      if (requestController && viewControllers) viewControllers.add(requestController);
      viewPromise = fetchDownloadViewData(page, requestController?.signal || signal)
        .finally(() => requestController && viewControllers?.delete(requestController));
      if (viewCache && cacheKey) viewCache.set(cacheKey, viewPromise);
    }
    const { data, returnedId } = await viewPromise;
    if (signal?.aborted) throw new Error("已取消");
    if (returnedId && !downloadVideoIdentityMatches(page.videoId, page.aid, returnedId, data.aid)) throw new Error("合集视频信息与条目 ID 不一致");
    const pages = Array.isArray(data.pages) ? data.pages : [];
    const selectedByCid = pages.find((item) => String(item?.cid || "") === String(page.cid));
    const selectedByPage = pages.find((item) => Number(item?.page) === Number(page.page));
    // 合集条目的 cid 是页面目录的提示值，官方 view 的 pages 才是当前 BV
    // 的权威映射。若旧 DOM/CID 已过期，按该 BV 自己的 page 映射修正，
    // 不要因为旧 CID 阻断整个合集任务。
    // page 是列表叶子的稳定位置，优先使用官方 pages 的 page→CID 映射。
    // 目录 CID 可能来自旧 DOM 或旧缓存；只有没有可用 page 映射时才用 CID
    // 回退，避免旧 CID 恰好命中另一个 P 后串片。
    const selectedPage = selectedByPage || selectedByCid || (pages.length === 1 ? pages[0] : null);
    const cid = String(selectedPage?.cid || data.cid || page.cid || "");
    if (!cid) throw new Error("合集视频的 CID 不可用");
    const officialTitle = selectDownloadTitle(data.title, page.title, entry.title, basePage.title) || page.title || basePage.title;
    return {
      ...page,
      videoId: returnedId || page.videoId,
      bvid: normalizedDownloadBvid(data.bvid) || page.bvid,
      aid: normalizedDownloadAid(data.aid) || page.aid,
      cid,
      title: officialTitle,
      duration: Number(selectedPage?.duration || data.duration) || page.duration
    };
  }
  function currentDownloadBatchRouteKey(fallbackPage = null) {
    if (isPlayPage()) return currentDownloadPageIdentity().routeKey;
    const drawerUrl = curUrl || activeRoute?.url || "";
    if (drawerUrl) return parseDownloadPageUrl(drawerUrl).routeKey;
    return String(fallbackPage?.routeKey || "");
  }
  function cancelDownloadBatch(reason = "批量任务已取消") {
    const context = DOWNLOAD_BATCH_CONTEXT;
    if (!context) return;
    context.cancelReason = reason;
    for (const controller of context.controllers) {
      try { controller.abort(reason); } catch {}
    }
    for (const controller of context.viewControllers || []) {
      try { controller.abort(reason); } catch {}
    }
    for (let index = DOWNLOAD_MERGE_QUEUE.length - 1; index >= 0; index--) {
      if (context.tasks.has(DOWNLOAD_MERGE_QUEUE[index].task)) DOWNLOAD_MERGE_QUEUE.splice(index, 1);
    }
    context.resolutionGate?.cancel();
    context.remoteDownloadGate?.cancel();
    mergeDownloadStats();
    for (const task of context.tasks) cancelDownloadTask(task);
    DOWNLOAD_BATCH_CONTEXT = null;
    DOWNLOAD_CAPTURE_STATS.batchActive = false;
    DOWNLOAD_CAPTURE_STATS.collectionBatchActive = false;
    DOWNLOAD_CAPTURE_STATS.lastBatchError = reason;
    if (context.hasCollection || context.scope === "collection" || context.scope === "mixed") DOWNLOAD_CAPTURE_STATS.lastCollectionError = reason;
  }
  async function runSelectedDownloadBatch(mode, entries, baseModel, targetVideo, targetAudio, scope = "episodes") {
    // 调用方已经按统一视频列表顺序传入条目。保留这个顺序，保证合集 BV、
    // 合集内部 P 和普通分 P 同时选择时，任务顺序与用户看到的列表一致。
    const selectedEntries = (entries || []).slice().sort((left, right) => (
      (Number(left.listOrder) || 0) - (Number(right.listOrder) || 0)
      || downloadBatchEntryScope(left).localeCompare(downloadBatchEntryScope(right))
      || (Number(left.collectionIndex) || 0) - (Number(right.collectionIndex) || 0)
      || (Number(left.page) || 0) - (Number(right.page) || 0)
    ));
    if (!selectedEntries.length) return;
    const hasCollection = selectedEntries.some((entry) => downloadBatchEntryScope(entry) === "collection");
    const hasBangumi = selectedEntries.some((entry) => downloadBatchEntryScope(entry) === "bangumi");
    const batchScope = downloadBatchScopeForEntries(selectedEntries) || scope || "episodes";
    cancelDownloadBatch("新的批量任务已开始");
    const basePage = isPlayPage() ? currentDownloadPageIdentity() : {
      videoId: baseModel.videoId,
      bvid: baseModel.bvid,
      aid: baseModel.aid,
      cid: baseModel.cid,
      page: baseModel.page,
      downloadScope: baseModel.downloadScope || "episodes",
      seasonId: baseModel.seasonId || "",
      epId: baseModel.epId || "",
      seasonIndex: baseModel.seasonIndex || 0,
      seasonLabel: baseModel.seasonLabel || "",
      episodeIndex: baseModel.episodeIndex || 0,
      multiSeason: !!baseModel.multiSeason,
      title: baseModel.title,
      filenameTitle: baseModel.filenameTitle,
      seasonTitle: baseModel.seasonTitle,
      duration: baseModel.duration,
      routeKey: baseModel.routeKey || `${baseModel.videoId}|p=${baseModel.page}|cid=${baseModel.cid}`
    };
    const context = {
      routeKey: basePage.routeKey,
      controllers: new Set(),
      viewCache: new Map(),
      viewControllers: new Set(),
      tasks: new Set(),
      cancelReason: "",
      scope: batchScope,
      hasCollection,
      hasBangumi,
      // 合集可能展开为数百个叶子 P。限制的是官方 view/playurl 身份解析，
      // 不是已经交给 GM_download 的分轨下载，也不是独立的 MP4 合并池。
      resolutionGate: createDownloadBatchResolutionGate(downloadBatchResolutionConcurrency(hasBangumi ? "bangumi" : batchScope)),
      // 番剧接口和媒体地址对同一页面状态更敏感，远程阶段固定最多 2 个；
      // 普通视频/合集不进入这个闸门。进入本地 MP4 Worker 后会释放该槽位。
      remoteDownloadGate: hasBangumi ? createDownloadBatchResolutionGate(2) : null
    };
    DOWNLOAD_BATCH_CONTEXT = context;
    DOWNLOAD_CAPTURE_STATS.batchActive = true;
    DOWNLOAD_CAPTURE_STATS.collectionBatchActive = hasCollection;
    DOWNLOAD_CAPTURE_STATS.batchMode = mode;
    DOWNLOAD_CAPTURE_STATS.collectionBatchMode = hasCollection ? mode : "";
    DOWNLOAD_CAPTURE_STATS.selectedCount = selectedEntries.length;
    DOWNLOAD_CAPTURE_STATS.collectionSelectedCount = selectedEntries.filter((entry) => downloadBatchEntryScope(entry) === "collection").length;
    DOWNLOAD_CAPTURE_STATS.lastBatchError = "";
    DOWNLOAD_CAPTURE_STATS.lastCollectionError = "";
    const jobs = selectedEntries.map(async (entry) => {
      const isCollection = downloadBatchEntryScope(entry) === "collection";
      const isBangumi = downloadBatchEntryScope(entry) === "bangumi";
      const itemIndex = isBangumi ? entry.episodeIndex : isCollection ? entry.collectionIndex : entry.page;
      const itemLabel = entry.label || downloadVideoListLabel(entry) || `${isCollection ? "C" : "P"}${String(itemIndex).padStart(2, "0")}`;
      const collectionRootTitle = isCollection
        ? selectDownloadTitle(baseModel.filenameTitle, baseModel.collectionRootTitle, baseModel.collectionTitle, baseModel.title) || baseModel.title
        : "";
      const entryTitle = isCollection
        ? selectDownloadTitle(entry.title, entry.part, baseModel.title) || baseModel.title
        : baseModel.title;
      const initialModel = {
        ...baseModel,
        page: entry.page || 1,
        episodeIndex: isBangumi ? entry.episodeIndex : 0,
        seasonId: isBangumi ? entry.seasonId : "",
        epId: isBangumi ? entry.epId : "",
        seasonIndex: isBangumi ? entry.seasonIndex : 0,
        seasonLabel: isBangumi ? entry.seasonLabel : "",
        multiSeason: isBangumi ? !!entry.multiSeason : false,
        collectionIndex: isCollection ? entry.collectionIndex : 0,
        collectionPageCount: isCollection ? entry.collectionPageCount || 1 : 1,
        collectionLabel: isCollection ? itemLabel : "",
        title: isBangumi ? selectDownloadTitle(entry.title, entry.part, baseModel.title) || baseModel.title : entryTitle,
        collectionTitle: isCollection ? collectionRootTitle : baseModel.collectionTitle,
        filenameTitle: isBangumi
          ? selectDownloadTitle(entry.filenameTitle, baseModel.filenameTitle, baseModel.seasonTitle, baseModel.title) || baseModel.title
          : isCollection ? entryTitle : baseModel.filenameTitle,
        collectionRootTitle: isCollection ? collectionRootTitle : baseModel.collectionRootTitle,
        downloadScope: isBangumi ? "bangumi" : isCollection ? "collection" : "episodes",
        videoId: isBangumi || isCollection ? entry.videoId : basePage.videoId,
        bvid: isBangumi || isCollection ? entry.bvid : basePage.bvid,
        aid: isBangumi || isCollection ? entry.aid : basePage.aid,
        cid: entry.cid
      };
      const taskKind = mode === "audio" ? "audio" : mode === "video" ? "video" : mode === "tracks" ? "tracks" : "merge";
      const task = makeDownloadTask(mode === "merge" ? "merge" : "tracks", buildDownloadTaskTitle(initialModel, taskKind, targetVideo, targetAudio));
      task.batchPage = entry.page || 1;
      task.batchIndex = itemIndex;
      task.batchScope = isBangumi ? "bangumi" : isCollection ? "collection" : "episodes";
      task.remoteDownloadGate = isBangumi ? context.remoteDownloadGate : null;
      task.retry = () => runSelectedDownloadBatch(mode, [entry], baseModel, targetVideo, targetAudio, scope);
      task.message = `${itemLabel}：正在获取对应视频的官方播放轨道…`;
      task.status = "downloading";
      context.tasks.add(task);
      updateDownloadTask(task, {});
      const valid = isBangumi
        ? isDownloadVideoListEntryValid(entry)
        : isCollection ? isDownloadCollectionEntryValid(entry) : isDownloadCatalogEntryValid(entry);
      if (!valid) {
        task.retry = null;
        runDownloadTaskError(task, new Error(`${itemLabel} 的视频身份或 CID 不可用，已跳过以避免串片`));
        if (isCollection) DOWNLOAD_CAPTURE_STATS.lastCollectionError = task.message;
        else DOWNLOAD_CAPTURE_STATS.lastBatchError = task.message;
        return;
      }
      const controller = new AbortController();
      context.controllers.add(controller);
      const cancel = () => controller.abort("任务已取消");
      task.cancelFunctions.push(cancel);
      let releaseResolution = null;
      try {
        releaseResolution = await context.resolutionGate.acquire(controller.signal);
        const page = isBangumi
          ? makeDownloadBangumiPage(entry, basePage)
          : isCollection
            ? await resolveDownloadCollectionPage(entry, basePage, controller.signal, context.viewCache, context.viewControllers)
            : makeDownloadEpisodePage(entry, basePage);
        let snapshot = isBangumi
          ? snapshotMatchesDownloadBangumiEpisode(baseModel, entry, basePage) ? baseModel : null
          : !isCollection && snapshotMatchesDownloadEpisode(baseModel, entry, basePage) ? baseModel : null;
        if (!snapshot) snapshot = (await fetchBatchDownloadSnapshot(page, controller.signal)).snapshot;
        if (!DOWNLOAD_BATCH_CONTEXT || DOWNLOAD_BATCH_CONTEXT !== context || context.routeKey !== currentDownloadBatchRouteKey(basePage)) throw new Error("页面已切换，已取消旧下载任务");
        const videoChoice = selectBatchVideoTrack(snapshot.videos, targetVideo);
        const audioChoice = selectBatchAudioTrack(snapshot.audios, targetAudio);
        const video = mode === "audio" ? null : videoChoice.track;
        const audio = audioChoice.track;
        if (mode !== "audio" && !video) throw new Error(videoChoice.reason || `${itemLabel} 没有可用视频轨`);
        if (!audio) throw new Error(audioChoice.reason || `${itemLabel} 没有可用音频轨`);
        const model = {
          ...snapshot,
          title: isBangumi || isCollection
            ? selectDownloadTitle(page.title, entry.title, entry.part, snapshot.title, baseModel.title) || baseModel.title
            : baseModel.title,
          collectionTitle: isCollection ? collectionRootTitle : snapshot.collectionTitle || baseModel.collectionTitle,
          filenameTitle: isBangumi
            ? selectDownloadTitle(page.filenameTitle, entry.filenameTitle, snapshot.filenameTitle, baseModel.filenameTitle, baseModel.title) || baseModel.title
            : isCollection
              ? selectDownloadTitle(page.title, entry.title, entry.part, snapshot.title, baseModel.title) || entryTitle
              : snapshot.filenameTitle || baseModel.filenameTitle,
          collectionRootTitle: isCollection ? collectionRootTitle : snapshot.collectionRootTitle || baseModel.collectionRootTitle,
          downloadScope: isBangumi ? "bangumi" : isCollection ? "collection" : "episodes",
          bvid: page.bvid || snapshot.bvid,
          videoId: page.videoId || snapshot.videoId,
          aid: page.aid || snapshot.aid,
          page: isCollection ? entry.page || page.page : page.page,
          collectionIndex: isCollection ? entry.collectionIndex : 0,
          collectionPageCount: isCollection ? entry.collectionPageCount || page.collectionPageCount || 1 : 1,
          collectionLabel: isCollection ? itemLabel : "",
          seasonId: isBangumi ? page.seasonId : "",
          epId: isBangumi ? page.epId : "",
          seasonIndex: isBangumi ? page.seasonIndex : 0,
          seasonLabel: isBangumi ? page.seasonLabel : "",
          multiSeason: isBangumi ? !!page.multiSeason : false,
          episodeIndex: isBangumi ? page.episodeIndex : 0,
          seasonTitle: isBangumi ? page.seasonTitle : "",
          cid: page.cid,
          duration: entry.duration || page.duration || snapshot.duration
        };
        const reasons = [videoChoice.degraded ? videoChoice.reason : "", audioChoice.degraded ? audioChoice.reason : ""].filter(Boolean).join("；");
        // 轨道身份和签名已经独立确认；从这里开始分轨立即交给下载管理器，
        // 合并立即进入自己的内存任务池，不再占用接口解析槽位。
        releaseResolution?.();
        releaseResolution = null;
        removeDownloadCancel(task, cancel);
        if (mode === "merge") enqueueMergeDownload(model, video, audio, task, reasons);
        else runSeparateDownload(model, video, audio, task, reasons);
        // 任务交给下载/合并队列后仍等待终态，以便路由切换可以统一取消。
        await task.donePromise;
      } catch (error) {
        removeDownloadCancel(task, cancel);
        runDownloadTaskError(task, error);
        const message = error instanceof Error ? error.message.slice(0, 180) : `${itemLabel} 任务失败`;
        if (isCollection) DOWNLOAD_CAPTURE_STATS.lastCollectionError = message;
        else DOWNLOAD_CAPTURE_STATS.lastBatchError = message;
      } finally {
        releaseResolution?.();
        context.controllers.delete(controller);
      }
    });
    await Promise.allSettled(jobs);
    context.resolutionGate.cancel();
    if (DOWNLOAD_BATCH_CONTEXT === context) {
      DOWNLOAD_BATCH_CONTEXT = null;
      DOWNLOAD_CAPTURE_STATS.batchActive = false;
      DOWNLOAD_CAPTURE_STATS.collectionBatchActive = false;
    }
  }
  function createUnifiedDownloadWorkspace(model, catalog = [], collection = []) {
    const root = document.createElement("section");
    root.className = "bk-download-workspace";
    const syncTheme = () => applyBiliKitTheme(root);
    root.__bilikitThemeSync = syncTheme;
    root.__bkDispose = () => {
      window.removeEventListener(BILIKIT_THEME_EVENT, syncTheme);
      try { root.__bkCatalogController?.abort("工作台已关闭"); } catch {}
    };
    syncTheme();
    window.addEventListener(BILIKIT_THEME_EVENT, syncTheme);
    root.dataset.bkVideoTrackCount = String(model.videos.length);
    root.dataset.bkAudioTrackCount = String(model.audios.length);

    let sourceCatalog = Array.isArray(catalog) ? catalog.slice() : [];
    let sourceCollection = Array.isArray(collection) ? collection.slice() : [];
    const videoListState = { entries: [], groups: [], selected: new Set() };
    root.__bkDownloadVideoListState = videoListState;

    const inner = document.createElement("div");
    inner.className = "bk-dw-inner";
    const heading = document.createElement("header");
    heading.className = "bk-dw-header";
    const headingTitle = document.createElement("h1");
    headingTitle.textContent = "视频下载工作台";
    const headingDesc = document.createElement("p");
    headingDesc.textContent = model.downloadScope === "bangumi"
      ? "番剧模式按季度和正片集展示；每集使用独立 season_id、ep_id、BVID/AID 与 CID 获取播放轨道。"
      : "普通视频模式统一列出同一 BV 的分 P 与不同 BV 的合集条目；每项按独立 BVID/AV 与 CID 获取播放轨道。";
    heading.append(headingTitle, headingDesc);

    const videoTitle = document.createElement("div");
    videoTitle.className = "bk-dw-video-title";
    videoTitle.textContent = model.title;
    const badges = document.createElement("p");
    badges.className = "bk-dw-meta";

    const listSection = document.createElement("section");
    listSection.className = "bk-dw-episodes bk-dw-video-list";
    const listHead = document.createElement("div");
    listHead.className = "bk-dw-episodes-head";
    const listHeading = document.createElement("h2");
    listHeading.textContent = "视频列表";
    const listTools = document.createElement("div");
    listTools.className = "bk-dw-episodes-tools";
    const list = document.createElement("div");
    list.className = "bk-dw-episode-list";
    const listButton = (label, callback) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", callback);
      listTools.appendChild(button);
      return button;
    };
    const updateListStats = () => {
      const collectionEntries = videoListState.entries.filter((entry) => entry.downloadScope === "collection");
      const validEntries = videoListState.entries.filter(isDownloadVideoListEntryValid);
      const selectedEntries = validEntries.filter((entry) => videoListState.selected.has(entry.listKey));
      DOWNLOAD_WORKSPACE_CATALOG = videoListState.entries.filter((entry) => entry.downloadScope !== "collection");
      DOWNLOAD_WORKSPACE_COLLECTION = collectionEntries;
      DOWNLOAD_CAPTURE_STATS.catalogCount = videoListState.entries.length;
      DOWNLOAD_CAPTURE_STATS.selectedCount = selectedEntries.length;
      DOWNLOAD_CAPTURE_STATS.collectionCount = collectionEntries.length;
      DOWNLOAD_CAPTURE_STATS.collectionSelectedCount = selectedEntries.filter((entry) => entry.downloadScope === "collection").length;
      const validCount = validEntries.length;
      listHeading.textContent = videoListState.entries.length
        ? `视频列表（已选 ${selectedEntries.length}/${validCount}）`
        : "视频列表";
    };
    const renderDownloadVideoListEntry = (entry, child = false) => {
      const valid = isDownloadVideoListEntryValid(entry);
      const item = document.createElement("label");
      item.className = `bk-dw-episode${child ? " bk-dw-episode-child" : ""}${entry.current ? " current" : ""}${valid ? "" : " invalid"}`;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = valid && videoListState.selected.has(entry.listKey);
      checkbox.disabled = !valid;
      checkbox.setAttribute("aria-label", `选择 ${entry.label || downloadVideoListLabel(entry)}`);
      checkbox.addEventListener("change", () => {
        if (!valid) return;
        if (checkbox.checked) videoListState.selected.add(entry.listKey);
        else videoListState.selected.delete(entry.listKey);
        refreshList();
      });
      const main = document.createElement("span");
      main.className = "bk-dw-episode-main";
      const entryTitle = document.createElement("span");
      entryTitle.className = "bk-dw-episode-title";
      const label = entry.label || downloadVideoListLabel(entry);
      const part = entry.collectionPageCount > 1 && entry.part && entry.part !== entry.title
        ? `${entry.title || "视频"} · ${entry.part}`
        : entry.title || entry.part || "Bilibili 视频";
      entryTitle.textContent = `${valid ? "" : "⚠ "}${label} · ${part}`;
      const meta = document.createElement("span");
      meta.className = "bk-dw-episode-meta";
      const identity = entry.bvid || entry.videoId || (entry.aid ? `av${entry.aid}` : "未知视频");
      meta.textContent = `${identity}${entry.cid ? ` · CID ${entry.cid}` : " · CID 待获取"}${entry.collectionPageCount > 1 ? ` · P${entry.page}` : ""}${entry.cidMismatch ? " · 目录 CID 不一致，已跳过" : ""}`;
      main.append(entryTitle, meta);
      const duration = document.createElement("span");
      duration.className = "bk-dw-episode-duration";
      duration.textContent = entry.durationLabel || formatDownloadEpisodeDuration(entry.duration);
      item.append(checkbox, main, duration);
      return item;
    };
    const refreshList = () => {
      list.replaceChildren();
      if (!videoListState.groups.length) {
        const empty = document.createElement("p");
        empty.className = "bk-dw-empty";
        empty.textContent = "正在读取视频列表；若页面没有合集或分 P，当前视频仍可单独下载。";
        list.appendChild(empty);
      }
      for (const group of videoListState.groups) {
        const children = group.children || [];
        const showGroup = group.kind === "bangumi-season" || group.kind === "collection" && children.length > 1;
        if (!showGroup) {
          if (children[0]) list.appendChild(renderDownloadVideoListEntry(children[0]));
          continue;
        }
        const validChildren = children.filter(isDownloadVideoListEntryValid);
        const selectedCount = validChildren.filter((entry) => videoListState.selected.has(entry.listKey)).length;
        const groupItem = document.createElement("label");
        groupItem.className = `bk-dw-episode bk-dw-episode-group${group.current ? " current" : ""}${validChildren.length ? "" : " invalid"}`;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = validChildren.length > 0 && selectedCount === validChildren.length;
        checkbox.indeterminate = selectedCount > 0 && selectedCount < validChildren.length;
        checkbox.disabled = !validChildren.length;
        checkbox.setAttribute("aria-label", `选择 ${group.label} 的全部${group.kind === "bangumi-season" ? "集" : "分 P"}`);
        checkbox.addEventListener("change", () => {
          videoListState.selected = setDownloadVideoListGroupSelection(videoListState.selected, group, checkbox.checked);
          refreshList();
        });
        const main = document.createElement("span");
        main.className = "bk-dw-episode-main";
        const entryTitle = document.createElement("span");
        entryTitle.className = "bk-dw-episode-title";
        entryTitle.textContent = `${group.label} · ${group.title || "Bilibili 视频"}`;
        const meta = document.createElement("span");
        meta.className = "bk-dw-episode-meta";
        const identity = group.bvid || group.videoId || (group.aid ? `av${group.aid}` : "未知视频");
        const totalDuration = validChildren.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0);
        const unit = group.kind === "bangumi-season" ? "集" : "P";
        meta.textContent = `${identity} · ${validChildren.length} 个${unit} · 已选 ${selectedCount} 个${totalDuration ? ` · 总时长 ${formatDownloadEpisodeDuration(totalDuration)}` : ""}`;
        main.append(entryTitle, meta);
        const duration = document.createElement("span");
        duration.className = "bk-dw-episode-duration";
        duration.textContent = "选择全部";
        groupItem.append(checkbox, main, duration);
        list.appendChild(groupItem);
        for (const entry of children) list.appendChild(renderDownloadVideoListEntry(entry, true));
      }
      updateListStats();
      const currentEntry = videoListState.entries.find((entry) => entry.current);
      const currentLabel = currentEntry?.label || (model.downloadScope === "bangumi"
        ? downloadVideoListLabel({ ...model, downloadScope: "bangumi", episodeIndex: model.episodeIndex, seasonIndex: model.seasonIndex, multiSeason: model.multiSeason })
        : downloadVideoListLabel({ page: model.page }));
      const bangumiSeasonCount = videoListState.groups.filter((group) => group.kind === "bangumi-season").length;
      badges.textContent = [
        model.videoId || model.bvid,
        `当前 ${currentLabel}`,
        videoListState.entries.length
          ? model.downloadScope === "bangumi"
            ? `${bangumiSeasonCount || 1} 个季度 · ${videoListState.entries.length} 个可选集`
            : `${videoListState.groups.filter((group) => group.kind === "collection").length} 个合集视频 · ${videoListState.entries.length} 个可选 P`
          : "列表等待更新",
        model.quality ? `当前画质 ${model.videos.find((track) => track.id === model.quality)?.qualityLabel || model.quality}` : "当前画质未知"
      ].filter(Boolean).join(" · ");
      root.dataset.bkDownloadScope = downloadBatchScopeForEntries(videoListState.entries);
    };
    listButton("全选", () => {
      videoListState.selected = new Set(videoListState.entries.filter(isDownloadVideoListEntryValid).map((entry) => entry.listKey));
      refreshList();
    });
    listButton("取消全选", () => {
      videoListState.selected.clear();
      refreshList();
    });
    listHead.append(listHeading, listTools);
    listSection.append(listHead, list);

    const selectors = document.createElement("div");
    selectors.className = "bk-dw-selectors";
    const makeSelect = (label, tracks, kind) => {
      const wrap = document.createElement("label");
      wrap.className = "bk-dw-field";
      const text = document.createElement("span");
      text.textContent = label;
      const select = document.createElement("select");
      select.setAttribute("aria-label", label);
      tracks.forEach((track, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = track.optionLabel || downloadTrackLabel(track);
        select.appendChild(option);
      });
      if (!tracks.length) {
        const option = document.createElement("option");
        option.textContent = `当前页面没有可用${kind === "video" ? "视频" : "音频"}轨`;
        select.appendChild(option);
        select.disabled = true;
      }
      wrap.append(text, select);
      return { wrap, select };
    };
    const qualityOptions = [];
    const seenQualities = new Set();
    for (const track of model.videos) {
      const key = String(track.id);
      if (seenQualities.has(key)) continue;
      seenQualities.add(key);
      qualityOptions.push({ ...track, optionLabel: track.qualityLabel || `画质 ${key}` });
    }
    const qualityControl = makeSelect("清晰度", qualityOptions, "video");
    const codecControl = makeSelect("编码", [], "video");
    const audioControl = makeSelect("音频轨", model.audios, "audio");
    const preferredQualityIndex = qualityOptions.findIndex((track) => track.id === model.quality);
    if (preferredQualityIndex >= 0) qualityControl.select.value = String(preferredQualityIndex);
    let codecTracks = [];
    const refreshCodecOptions = () => {
      const selectedQuality = qualityOptions[Number(qualityControl.select.value)]?.id;
      codecTracks = model.videos.filter((track) => String(track.id) === String(selectedQuality));
      const codecCounts = new Map();
      for (const track of codecTracks) codecCounts.set(downloadCodecLabel(track), (codecCounts.get(downloadCodecLabel(track)) || 0) + 1);
      codecControl.select.replaceChildren();
      codecControl.select.disabled = !codecTracks.length;
      if (!codecTracks.length) {
        const option = document.createElement("option");
        option.textContent = "当前清晰度无可用编码";
        codecControl.select.appendChild(option);
        return;
      }
      codecTracks.forEach((track, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        let label = downloadCodecLabel(track);
        if (codecCounts.get(label) > 1) label += ` · ${track.codecs || ""}${track.bandwidth ? ` · ${Math.round(track.bandwidth / 1000)} kbps` : ""}`;
        option.textContent = label;
        codecControl.select.appendChild(option);
      });
    };
    selectors.append(qualityControl.wrap, codecControl.wrap, audioControl.wrap);

    const availability = document.createElement("p");
    availability.className = "bk-dw-availability";
    availability.dataset.bkDownloadAvailability = "";
    availability.textContent = model.videos.length || model.audios.length
      ? "当前页面没有完整的 DASH 音视频轨。请确认视频可正常播放；工作台不会绕过登录、付费或受保护资源。"
      : "正在从 B 站播放接口获取当前视频的 DASH 音视频轨…";
    availability.hidden = !!model.videos.length && !!model.audios.length;
    const actions = document.createElement("div");
    actions.className = "bk-dw-actions";
    const makeAction = (label, primary, callback) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `bk-dw-action${primary ? " primary" : ""}`;
      button.textContent = label;
      button.addEventListener("click", callback);
      actions.appendChild(button);
      return button;
    };
    const selectedVideo = () => codecTracks[Number(codecControl.select.value)] || null;
    const selectedAudio = () => model.audios[Number(audioControl.select.value)] || null;
    const runSelectedBatch = (mode) => {
      const entries = videoListState.entries.filter((entry) => isDownloadVideoListEntryValid(entry) && videoListState.selected.has(entry.listKey));
      if (!entries.length) {
        availability.hidden = false;
        availability.textContent = "请至少选择一个视频列表项。";
        return;
      }
      const scope = downloadBatchScopeForEntries(entries);
      void runSelectedDownloadBatch(mode, entries, model, selectedVideo(), selectedAudio(), scope);
    };
    const retryButton = makeAction("重新获取轨道", false, () => {
      if (inDrawer) postFrameCommand("bk-drawer-download-retry");
      else void fetchCurrentDownloadPlayinfo(true);
    });
    retryButton.dataset.bkDownloadRetry = "";
    retryButton.hidden = !!model.videos.length && !!model.audios.length;
    const mergeButton = makeAction("合并选中视频（MP4）", true, () => runSelectedBatch("merge"));
    const separateButton = makeAction("分别下载选中视频的音视频轨", false, () => runSelectedBatch("tracks"));
    const audioOnlyButton = makeAction("仅下载选中视频的音频轨", false, () => runSelectedBatch("audio"));
    const note = document.createElement("p");
    note.className = "bk-dw-note";
    note.textContent = model.downloadScope === "bangumi"
      ? "这是番剧下载模式：多季度按 S01、S02 分组，季度父项可全选，集项可单独选择；每个集单独使用自己的 season_id、ep_id、BVID/AID 和 CID。番剧远程播放请求最多并发 2 个，进入本地 MP4 合并后仍按内存预算和最多 4 个 Worker 调度。"
      : "这是普通视频模式：合集视频父项可一次勾选该 BV 的全部 P，子项也可单独选择；合集中的其它 BV、当前 BV 的多个 P 和普通分 P 可以同时加入同一批任务。每个叶子项单独获取对应 BV/CID 的播放轨道，合集内多 P 显示为 Cxx_Pyy。合并不重新编码，过期、付费或受保护资源不会绕过。";
    const taskHeading = document.createElement("h2");
    taskHeading.className = "bk-dw-task-heading";
    taskHeading.textContent = "当前会话任务";
    const overview = document.createElement("div");
    overview.className = "bk-dw-overview";
    overview.dataset.bkDownloadOverview = "";
    const overviewItems = [["speed", "总下载速度"], ["overall", "综合进度"], ["downloadEta", "预计下载"], ["totalEta", "预计总计"]];
    for (const [key, label] of overviewItems) {
      const item = document.createElement("div");
      item.className = "bk-dw-overview-item";
      item.dataset.bkOverview = key;
      const labelNode = document.createElement("span");
      labelNode.className = "bk-dw-overview-label";
      labelNode.textContent = label;
      const valueNode = document.createElement("span");
      valueNode.className = "bk-dw-overview-value";
      valueNode.textContent = "--";
      item.append(labelNode, valueNode);
      overview.appendChild(item);
    }
    const taskList = document.createElement("div");
    taskList.className = "bk-dw-tasks";
    taskList.dataset.bkDownloadTasks = "";
    inner.append(heading, videoTitle, badges, listSection, selectors, availability, actions, note, taskHeading, overview, taskList);
    root.appendChild(inner);

    const refreshMergeButton = () => {
      const supported = canRemuxDownload(selectedVideo(), selectedAudio());
      mergeButton.disabled = !supported;
      mergeButton.title = supported ? "不重新编码，直接重封装为可 seek 的 MP4" : "所选轨道编码无法通过 MP4 直通封装；仍可分轨下载";
      separateButton.disabled = !selectedVideo() || !selectedAudio();
      audioOnlyButton.disabled = !selectedAudio();
    };
    const refreshVideoList = (preserveSelection = true) => {
      const previous = videoListState.selected;
      videoListState.entries = buildDownloadVideoList(sourceCatalog, sourceCollection, model);
      videoListState.groups = buildDownloadVideoListGroups(videoListState.entries);
      const keep = preserveSelection && previous.size
        ? videoListState.entries.filter((entry) => isDownloadVideoListEntryValid(entry) && previous.has(entry.listKey))
        : [];
      const current = videoListState.entries.find((entry) => entry.current);
      videoListState.selected = new Set((keep.length ? keep : current ? [current] : []).map((entry) => entry.listKey));
      refreshList();
    };
    root.__bkRefreshDownloadCatalog = (entries) => {
      sourceCatalog = Array.isArray(entries) ? entries.slice() : [];
      refreshVideoList(true);
    };
    root.__bkRefreshDownloadCollection = (entries) => {
      sourceCollection = Array.isArray(entries) ? entries.slice() : [];
      refreshVideoList(true);
    };
    root.__bkRefreshDownloadVideoList = refreshVideoList;
    qualityControl.select.addEventListener("change", () => { refreshCodecOptions(); refreshMergeButton(); });
    codecControl.select.addEventListener("change", refreshMergeButton);
    audioControl.select.addEventListener("change", refreshMergeButton);
    refreshCodecOptions();
    refreshMergeButton();
    refreshVideoList(false);
    DOWNLOAD_WORKSPACE_ROOT = root;
    renderDownloadTasks();
    return root;
  }
  function updateDownloadWorkspaceFetchStatus(status = {}) {
    const root = DOWNLOAD_WORKSPACE_ROOT;
    if (!root?.isConnected) return;
    const availability = root.querySelector("[data-bk-download-availability]");
    const retryButton = root.querySelector("[data-bk-download-retry]");
    if (!availability) return;
    const complete = Number(root.dataset.bkVideoTrackCount) > 0 && Number(root.dataset.bkAudioTrackCount) > 0;
    const state = String(status.state || "idle");
    if (complete) {
      availability.hidden = true;
      if (retryButton) retryButton.hidden = true;
      return;
    }
    availability.hidden = false;
    if (status.message) availability.textContent = String(status.message).slice(0, 180);
    if (retryButton) {
      retryButton.hidden = state === "loading";
      retryButton.disabled = state === "loading";
    }
  }
  function installPlayerDownloadEntry() {
    if (window.__BILIKIT_PLAYER_DOWNLOAD_ENTRY__) return null;
    if (window.top !== window.self && !inDrawer) return;
    window.__BILIKIT_PLAYER_DOWNLOAD_ENTRY__ = true;
    const runtime = getRuntimeCoordinator();
    let retryTimer = 0;
    const attach = () => {
      retryTimer = 0;
      if (!isPlayPage()) return;
      const menu = document.querySelector(".bpx-player-contextmenu");
      if (!menu || !menu.isConnected || menu.querySelector(":scope > li[data-bk-download-entry]")) return;
      const item = document.createElement("li");
      item.dataset.bkDownloadEntry = "";
      item.textContent = "BiliKit 视频下载工作台";
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        menu.classList.remove("bpx-player-active");
        const snapshot = readCurrentDownloadSnapshot();
        const page = currentDownloadPageIdentity();
        const catalog = readDownloadEpisodeCatalogFromDom(page);
        const collection = readDownloadCollectionCatalog(page);
        if (inDrawer) postDrawer("bk-drawer-download-open", { workbench: snapshot, catalog, collection });
        else window.__BILIKIT_OPEN_DOWNLOAD_WORKSPACE__?.(snapshot, catalog, collection);
        if (!snapshot.videos.length || !snapshot.audios.length) void fetchCurrentDownloadPlayinfo(false);
      });
      menu.appendChild(item);
    };
    const scheduleAttach = () => {
      if (retryTimer) clearTimeout(retryTimer);
      attach();
      retryTimer = setTimeout(attach, 60);
    };
    const onContextMenu = (event) => {
      const target = event.composedPath().find((node) => node instanceof Element);
      if (target?.closest(".bpx-player-container")) scheduleAttach();
    };
    const removeContextListener = runtime.listen(document, "contextmenu", onContextMenu, true);
    attach();
    const dispose = () => {
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = 0;
      removeContextListener?.();
      document.querySelectorAll("li[data-bk-download-entry]").forEach((item) => item.remove());
      if (window.__BILIKIT_PLAYER_DOWNLOAD_ENTRY__) delete window.__BILIKIT_PLAYER_DOWNLOAD_ENTRY__;
    };
    runtime.addCleanup(dispose);
    return dispose;
  }
