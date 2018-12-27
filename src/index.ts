
import { RPCServer, ServerError } from 'castle-rpc-server/dist/index'
import * as WebSocket from 'koa-websocket'
import { controller, config_route } from 'castle-router'
import { RPC } from 'castle-rpc';
import { config } from 'castle-server/dist/use/config'
import { install as SessionInstall } from 'castle-session'
export const ServerConfig = {
    WebSockets: [],
    //WebSocket 处理服务
    WSHanders: {}
}
class WSRPCService extends RPCServer {
    constructor() {
        super({})
    }
    async controller(path, data, rpc, ctx) {
        ctx.path = path.substr(0, 1) == '/' ? path : '/' + path;
        await config_route(ctx, () => { })
        ctx.req.body = data
        let rs: any = await controller(ctx)
        return rs;
    }
    async send(content: RPC | string | Buffer, ctx) {
        if ('object' == typeof content) {
            if (ctx.RPCEncoding != 'text' && content['encode'] instanceof Function) {
                content = content['encode']()
            } else {
                content = JSON.stringify(content)
            }
        }
        if (ctx.websocket.readyState == 1)
            return ctx.websocket.send(content)
        return null;
    }
    async sendTo(ID, Content, ctx) {
        try {
            if (this.clients[ID] && this.clients[ID].options && this.clients[ID].options.websocket) {
                return this.send(Content, this.clients[ID].options)
            } else {
                throw ServerError.NOT_ONLINE
            }
        } catch (error) {
            return false;
        }
    }
    get onlines() {
        return this.clients;
    }
}
export const WSRPCServer = new WSRPCService()
export function install(that: any, koa: any, conf: any) {
    that._koa = new WebSocket(koa)
    //启用WebSocket服务
    that._koa.ws.use(config)
    that._koa.ws.use(function ws_route(ctx, next) {
        //超时自动关闭
        setTimeout(() => {
            if (!ctx.ID) {
                ctx.websocket.close()
            }
        }, 3000)
        ctx.websocket.on('message', async (message: any) => {
            if ('string' == typeof message) {
                ctx.RPCEncoding = 'text'
            }
            WSRPCServer.message(message, ctx)
        })
        ctx.websocket.on('close', () => {
            WSRPCServer.close(ctx)
        })
        next();
    })
    SessionInstall(that, that._koa.ws, {})
}