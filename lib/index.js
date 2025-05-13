"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const net = __importStar(require("net"));
const events_1 = __importDefault(require("events"));
const channel_1 = require("./channel");
class AGIServer extends events_1.default.EventEmitter {
    constructor(props) {
        super();
        this.port = 4573;
        try {
            this.port = (props === null || props === void 0 ? void 0 : props.port) || this.port;
            if (props.server) {
                // Usa servidor TCP externo (ex: criado no cluster)
                this.fAGI = props.server;
                this.fAGI.on("connection", this._handleSocket.bind(this));
                this.emit("ready", "external");
            }
            else {
                // Cria servidor interno como antes
                this._bind();
            }
        }
        catch (err) {
            console.log(`AGIServer error`, err);
        }
    }
    /**
     * Cria e escuta o servidor, se não for externo
     */
    _bind() {
        try {
            this.fAGI = net.createServer(this._handleSocket.bind(this));
            this.fAGI.listen(this.port, () => {
                this.emit("ready", this.port);
            });
        }
        catch (err) {
            console.log(`AGIServer bind error`, err);
        }
    }
    /**
     * Lida com cada conexão AGI
     */
    _handleSocket(socket) {
        const remoteServer = (socket === null || socket === void 0 ? void 0 : socket.remoteAddress)
            ? socket.remoteAddress.split(":").pop() || false
            : false;
        let dataBuffer = "";
        socket.on("data", (data) => __awaiter(this, void 0, void 0, function* () {
            dataBuffer += data.toString();
            if (dataBuffer.includes("\n\n")) {
                socket.removeAllListeners("data");
                const agiVariables = dataBuffer
                    .split("\n")
                    .reduce((acc, line) => {
                    if (line.startsWith("agi_")) {
                        const [key, value] = line
                            .split(":")
                            .map((item) => item.trim());
                        acc[key.substring(4)] = value;
                    }
                    return acc;
                }, {});
                // Hangup detection
                socket.on("data", (data) => __awaiter(this, void 0, void 0, function* () {
                    if (data.toString().includes("HANGUP")) {
                        socket.removeAllListeners("data");
                        socket.end();
                    }
                }));
                const call = new channel_1.AGIChannel(Object.assign(Object.assign({}, agiVariables), { remoteServer,
                    socket }));
                this.emit("call", call);
                socket.on("end", () => {
                    call.emit("hangup");
                });
            }
        }));
    }
}
module.exports = AGIServer;
