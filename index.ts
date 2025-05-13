import * as net from "net";
import events from "events";
import { AGIChannel } from "./channel";

class AGIServer extends events.EventEmitter {
  public port: number = 4573;
  private fAGI?: net.Server;

  constructor(props: { port?: number; server?: net.Server }) {
    super();
    try {
      this.port = props?.port || this.port;

      if (props.server) {
        // Usa servidor TCP externo (ex: criado no cluster)
        this.fAGI = props.server;
        this.fAGI.on("connection", this._handleSocket.bind(this));
        this.emit("ready", "external");
      } else {
        // Cria servidor interno como antes
        this._bind();
      }
    } catch (err) {
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
    } catch (err) {
      console.log(`AGIServer bind error`, err);
    }
  }

  /**
   * Lida com cada conexão AGI
   */
  _handleSocket(socket: net.Socket) {
    const remoteServer: string | false = socket?.remoteAddress
      ? socket.remoteAddress.split(":").pop() || false
      : false;

    let dataBuffer = "";
    socket.on("data", async (data) => {
      dataBuffer += data.toString();
      if (dataBuffer.includes("\n\n")) {
        socket.removeAllListeners("data");

        const agiVariables = dataBuffer
          .split("\n")
          .reduce<{ [key: string]: string }>((acc, line) => {
            if (line.startsWith("agi_")) {
              const [key, value] = line
                .split(":")
                .map((item) => item.trim());
              acc[key.substring(4)] = value;
            }
            return acc;
          }, {});

        // Hangup detection
        socket.on("data", async (data) => {
          if (data.toString().includes("HANGUP")) {
            socket.removeAllListeners("data");
            socket.end();
          }
        });

        const call = new AGIChannel({
          ...agiVariables,
          remoteServer,
          socket,
        });
        this.emit("call", call);

        socket.on("end", () => {
          call.emit("hangup");
        });
      }
    });
  }
}

module.exports = AGIServer;
