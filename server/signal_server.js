var ws = require("nodejs-websocket")
var prort = 8099;

const SIGNAL_TYPE_JOIN = "join"; // join 主动加入房间
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  // 告知加入者对方是谁
const SIGNAL_TYPE_LEAVE = "leave";// leave 主动离开房间// leave 主动离开房间
const SIGNAL_TYPE_NEW_PEER = "new-peer";// new-peer 有人加入房间，通知已经在房间的人
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";// peer-leave 有人离开房间，通知已经在房间的人
const SIGNAL_TYPE_OFFER = "offer";// offer 发送offer给对端peer
const SIGNAL_TYPE_ANSWER = "answer";// answer发送offer给对端peer
const SIGNAL_TYPE_CANDIDATE = "candidate";// candidate 发送candidate给对端peers


/** ----- RTCMap ----- */
var RTCMap = function () {
    this._entrys = new Array();

    this.put = function (key, value) {
        if (key == null || key == undefined) {
            return;
        }
        var index = this._getIndex(key);
        if (index == -1) {
            var entry = new Object();
            entry.key = key;
            entry.value = value;
            this._entrys[this._entrys.length] = entry;
        } else {
            this._entrys[index].value = value;
        }
    };
    this.get = function (key) {
        var index = this._getIndex(key);
        return (index != -1) ? this._entrys[index].value : null;
    };
    this.remove = function (key) {
        var index = this._getIndex(key);
        if (index != -1) {
            this._entrys.splice(index, 1);
        }
    };
    this.clear = function () {
        this._entrys.length = 0;
    };
    this.contains = function (key) {
        var index = this._getIndex(key);
        return (index != -1) ? true : false;
    };
    this.size = function () {
        return this._entrys.length;
    };
    this.getEntrys = function () {
        return this._entrys;
    };
    this._getIndex = function (key) {
        if (key == null || key == undefined) {
            return -1;
        }
        var _length = this._entrys.length;
        for (var i = 0; i < _length; i++) {
            var entry = this._entrys[i];
            if (entry == null || entry == undefined) {
                continue;
            }
            if (entry.key === key) {// equal
                return i;
            }
        }
        return -1;
    };
}

var roomTableMap = new RTCMap();

function Client(uid, conn, roomId) {
    this.uid = uid;     // 用户所属的id
    this.conn = conn;   // uid对应的websocket连接
    this.roomId = roomId;
}

function handleJoin(message,conn){
	var roomId=message.roomId;
	var uid=message.uid;
	console.log("roomId= "+roomId+" uid="+uid);

	var roomMap = roomTableMap.get(roomId);
	if (roomMap == null) {
	    roomMap = new  RTCMap();
	    roomTableMap.put(roomId, roomMap);
	}
	
	if(roomMap.size() >= 2) {
	    console.error("roomId:" + roomId + " 已经有两人存在，请使用其他房间");
	    // 加信令通知客户端，房间已满
	    return;
	}
	
	var client = new Client(uid, conn, roomId);
	roomMap.put(uid, client);
	if(roomMap.size() > 1) {
	    // 房间里面已经有人了，加上新进来的人，那就是>=2了，所以要通知对方
	    var clients = roomMap.getEntrys();
	    for(var i in clients) {
	        var remoteUid = clients[i].key;
	        if (remoteUid != uid) {
	            var jsonMsg = {
	                'cmd': SIGNAL_TYPE_NEW_PEER,
	                'remoteUid': uid
	            };
	            var msg = JSON.stringify(jsonMsg);
	            var remoteClient =roomMap.get(remoteUid);
	            console.info("new-peer: " + msg);
	            remoteClient.conn.sendText(msg);
	
	            jsonMsg = {
	                'cmd':SIGNAL_TYPE_RESP_JOIN,
	                'remoteUid': remoteUid
	            };
	            msg = JSON.stringify(jsonMsg);
	            console.info("resp-join: " + msg);
	            conn.sendText(msg);
	        }
	    }
	}
	
	
}


function handleLeave(message) {
    var roomId = message.roomId;
    var uid = message.uid;

    console.info("uid: " + uid + "leave room " + roomId);

    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("handleLeave can't find then roomId " + roomId);
        return;
    }
    roomMap.remove(uid);        // 删除发送者
    if(roomMap.size() >= 1) {
        var clients = roomMap.getEntrys();
        for(var i in clients) {
            var jsonMsg = {
                'cmd': 'peer-leave',
                'remoteUid': uid // 谁离开就填写谁
            };
            var msg = JSON.stringify(jsonMsg);
            var remoteUid = clients[i].key;
            var remoteClient = roomMap.get(remoteUid);
            if(remoteClient) {
                console.info("notify peer:" + remoteClient.uid + ", uid:" + uid + " leave");
                remoteClient.conn.sendText(msg);
            }
        }
    }
}

function handleOffer(message) {
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;

    console.info("handleOffer uid: " + uid + "transfer  offer  to remoteUid" + remoteUid);

    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("handleOffer can't find then roomId " + roomId);
        return;
    }

    if(roomMap.get(uid) == null) {
        console.error("handleOffer can't find then uid " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if(remoteClient) {
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    } else {
        console.error("can't find remoteUid： " + remoteUid);
    }
}

function handleAnswer(message) {
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;

    console.info("handleAnswer uid: " + uid + "transfer answer  to remoteUid" + remoteUid);

    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("handleAnswer can't find then roomId " + roomId);
        return;
    }

    if(roomMap.get(uid) == null) {
        console.error("handleAnswer can't find then uid " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if(remoteClient) {
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    } else {
        console.error("can't find remoteUid： " + remoteUid);
    }
}

function handleOffer(message) {
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;

    console.info("handleOffer uid: " + uid + "transfer  offer  to remoteUid" + remoteUid);

    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("handleOffer can't find then roomId " + roomId);
        return;
    }

    if(roomMap.get(uid) == null) {
        console.error("handleOffer can't find then uid " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if(remoteClient) {
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    } else {
        console.error("can't find remoteUid： " + remoteUid);
    }
}

function handleCandidate(message) {
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;

    console.info("handleCandidate uid: " + uid + "transfer candidate  to remoteUid" + remoteUid);

    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("handleCandidate can't find then roomId " + roomId);
        return;
    }

    if(roomMap.get(uid) == null) {
        console.error("handleCandidate can't find then uid " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if(remoteClient) {
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    } else {
        console.error("can't find remoteUid： " + remoteUid);
    }
}

function handleForceLeave(client) {
    var roomId = client.roomId;
    var uid = client.uid;

    // 1. 先查找房间号
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.warn("handleForceLeave can't find then roomId " + roomId);
        return;
    }

    // 2. 判别uid是否在房间
    if (!roomMap.contains(uid)) {
        console.info("uid: " + uid +" have leave roomId " + roomId);
        return;
    }

    // 3.走到这一步，说明客户端没有正常离开，所以我们要执行离开程序
    console.info("uid: " + uid + " force leave room " + roomId);

    roomMap.remove(uid);        // 删除发送者
    if(roomMap.size() >= 1) {
        var clients = roomMap.getEntrys();
        for(var i in clients) {
            var jsonMsg = {
                'cmd': 'peer-leave',
                'remoteUid': uid // 谁离开就填写谁
            };
            var msg = JSON.stringify(jsonMsg);
            var remoteUid = clients[i].key;
            var remoteClient = roomMap.get(remoteUid);
            if(remoteClient) {
                console.info("notify peer:" + remoteClient.uid + ", uid:" + uid + " leave");
                remoteClient.conn.sendText(msg);
            }
        }
    }
}
var server = ws.createServer(function(conn){
    console.log("创建一个新的连接--------")

    conn.sendText("我收到你的连接了....");
    conn.on("text", function(str) {
        console.info("recv msg:" + str);
		var jsonMsg=JSON.parse(str);
		switch(jsonMsg.cmd){
			case SIGNAL_TYPE_JOIN:
				handleJoin(jsonMsg,conn);
				break;
			case SIGNAL_TYPE_LEAVE:
			    handleLeave(jsonMsg);
			    break;
			case SIGNAL_TYPE_OFFER:
			    handleOffer(jsonMsg);
			    break;   
			case SIGNAL_TYPE_ANSWER:
			    handleAnswer(jsonMsg);
			    break; 
			case SIGNAL_TYPE_CANDIDATE:
			    handleCandidate(jsonMsg);
			break;      	
		}
    });

   conn.on("close", function(code, reason) {
       console.info("连接关闭 code: " + code + ", reason: " + reason);
       if(conn.client != null) {
           // 强制让客户端从房间退出
           handleForceLeave(conn.client);
       }
   });

    conn.on("error", function(err) {
        console.info("监听到错误:" + err);
    });
}).listen(prort);