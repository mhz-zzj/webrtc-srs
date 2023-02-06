const SIGNAL_TYPE_JOIN = "join"; // join 主动加入房间
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  // 告知加入者对方是谁
const SIGNAL_TYPE_LEAVE = "leave";// leave 主动离开房间// leave 主动离开房间
const SIGNAL_TYPE_NEW_PEER = "new-peer";// new-peer 有人加入房间，通知已经在房间的人
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";// peer-leave 有人离开房间，通知已经在房间的人
const SIGNAL_TYPE_OFFER = "offer";// offer 发送offer给对端peer
const SIGNAL_TYPE_ANSWER = "answer";// answer发送offer给对端peer
const SIGNAL_TYPE_CANDIDATE = "candidate";// candidate 发送candidate给对端peers


var localUserId = Math.random().toString(36).substr(2); // 本地uid
var remoteUserId = -1;      // 对端
var roomId = 0;
var pc=null;

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var localStream = null;
var remoteStream = null;

var rtcEngine;
var RtcEngine=function(wsURL){
	this.init(wsURL);
	rtcEngine=this;
	return this;
}

RtcEngine.prototype.init=function(wsURL){
	this.wsURL=wsURL;//设置websocket的url
	this.signaling=null;//websocket对象
}

RtcEngine.prototype.createWebSocket=function(){
	rtcEngine=this;
	rtcEngine.signaling=new WebSocket(this.wsURL);
	rtcEngine.signaling.onopen=function(){
		rtcEngine.onOpen();
	}
	rtcEngine.signaling.onmessage=function(ev){
		rtcEngine.onMessage(ev);
	}
	rtcEngine.signaling.onerror=function(ev){
		rtcEngine.onError(ev);
	}
	rtcEngine.signaling.onclose=function(ev){
		rtcEngine.onClose(ev);
	}
}

RtcEngine.prototype.onOpen=function(){
	console.log("onOpen");
}

RtcEngine.prototype.onMessage=function(event){
	console.log("onMessage: " + event.data);
	var jsonMsg = null;
	try {
	     jsonMsg = JSON.parse(event.data);
	} catch(e) {
	    console.warn("onMessage parse Json failed:" + e);
	    return;
	}
	
	switch (jsonMsg.cmd) {
	    case SIGNAL_TYPE_NEW_PEER:
	        handleRemoteNewPeer(jsonMsg);
	        break;
	    case SIGNAL_TYPE_RESP_JOIN:
	        handleResponseJoin(jsonMsg);
	        break;
	    case SIGNAL_TYPE_PEER_LEAVE:
	        handleRemotePeerLeave(jsonMsg);
	        break;
	    case SIGNAL_TYPE_OFFER:
	        handleRemoteOffer(jsonMsg);
	        break;
	    case SIGNAL_TYPE_ANSWER:
	        handleRemoteAnswer(jsonMsg);
	        break;
	    case SIGNAL_TYPE_CANDIDATE:
	        handleRemoteCandidate(jsonMsg);
	        break;
	}
}

RtcEngine.prototype.onError=function(event){
	console.log("onError: "+event.data);
}

RtcEngine.prototype.onClose=function(event){
	console.log("onClose -> code: " + event.code + ", reason:" + EventTarget.reason);
}

RtcEngine.prototype.sendMessage=function(message){
	this.signaling.send(message);
}

function doJoin(roomId){
	var jsonMsg = {
	    'cmd': 'join',
	    'roomId': roomId,
	    'uid': localUserId,
	}; 
	var message = JSON.stringify(jsonMsg);
	rtcEngine.sendMessage(message);
	console.info("doJoin message: " + message);
} 


function handleResponseJoin(message) {
    console.info("handleResponseJoin, remoteUid: " + message.remoteUid);
    remoteUserId = message.remoteUid;
    // doOffer();
}

function handleRemoteNewPeer(message) {
    console.info("handleRemoteNewPeer, remoteUid: " + message.remoteUid);
    remoteUserId = message.remoteUid;
    doOffer();
}

function doOffer(){
	if(pc==null){
		createPeerConnection();
	}
	pc.createOffer().then(createOfferAndSendMessage).catch(handleCreateOfferError);
}

function createPeerConnection() {
	var defaultConfiguration = {
	    bundlePolicy: "max-bundle",
	    rtcpMuxPolicy: "require",
	    iceTransportPolicy:"relay",//relay 或者 all
	    // 修改ice数组测试效果，需要进行封装
	    iceServers: [
	        {
	            "urls": [
	                "turn:192.168.10.133:3478?transport=udp",
	                "turn:192.168.10.133:3478?transport=tcp"       // 可以插入多个进行备选
	            ],
	            "username": "lqf",
	            "credential": "123456"
	        },
	        {
	            "urls": [
	                "stun:192.168.10.133:3478"
	            ]
	        }
	    ]
	};
	
	pc = new RTCPeerConnection(defaultConfiguration);
    pc.onicecandidate = handleIceCandidate;//调用函数
    pc.ontrack = handleRemoteStreamAdd;//调用函数

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
}

function handleIceCandidate(event) {
    console.info("handleIceCandidate");
    if (event.candidate) {
        var jsonMsg = {
            'cmd': 'candidate',
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid': remoteUserId,
            'msg': JSON.stringify(event.candidate)
        };
        var message = JSON.stringify(jsonMsg);
        rtcEngine.sendMessage(message);
        // console.info("handleIceCandidate message: " + message);
        console.info("send candidate message");
    } else {
        console.warn("End of candidates");
    }
}

function handleRemoteStreamAdd(event) {
    console.info("handleRemoteStreamAdd");
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
}


function createOfferAndSendMessage(session) {
    pc.setLocalDescription(session)
        .then(function () {
            var jsonMsg = {
                'cmd': 'offer',
                'roomId': roomId,
                'uid': localUserId,
                'remoteUid': remoteUserId,
                'msg': JSON.stringify(session)
            };
            var message = JSON.stringify(jsonMsg);
            rtcEngine.sendMessage(message);
			console.info("send offer message");
            //console.info("send offer message: " + message);
        })
        .catch(function (error) {
            console.error("offer setLocalDescription failed: " + error);
        });

}

function handleCreateOfferError(error) {
    console.error("handleCreateOfferError: " + error);
}


function handleRemotePeerLeave(message) {
    console.info("handleRemotePeerLeave, remoteUid: " + message.remoteUid);
    remoteVideo.srcObject = null;
}

function handleRemoteOffer(message) {
    console.info("handleRemoteOffer");
    if(pc == null) {
        createPeerConnection();
    }
    var desc = JSON.parse(message.msg);
    pc.setRemoteDescription(desc);
    doAnswer();
}

function doAnswer() {
    pc.createAnswer().then(createAnswerAndSendMessage).catch(handleCreateAnswerError);
}

function createAnswerAndSendMessage(session) {
    pc.setLocalDescription(session)
        .then(function () {
            var jsonMsg = {
                'cmd': 'answer',
                'roomId': roomId,
                'uid': localUserId,
                'remoteUid': remoteUserId,
                'msg': JSON.stringify(session)
            };
            var message = JSON.stringify(jsonMsg);
            rtcEngine.sendMessage(message);
            // console.info("send answer message: " + message);
            console.info("send answer message");
        })
        .catch(function (error) {
            console.error("answer setLocalDescription failed: " + error);
        });

}

function handleCreateAnswerError(error) {
    console.error("handleCreateAnswerError: " + error);
}

function handleRemoteAnswer(message) {
    console.info("handleRemoteAnswer");
    var desc = JSON.parse(message.msg);
    pc.setRemoteDescription(desc);
}

function handleRemoteCandidate(message) {
    console.info("handleRemoteCandidate");
    var candidate = JSON.parse(message.msg);
    pc.addIceCandidate(candidate).catch(e => {
        console.error("addIceCandidate failed:" + e.name);
    });
}


rtcEngine=new RtcEngine("ws://192.168.10.133:8099");
rtcEngine.createWebSocket();



function openLocalStream(stream) {
	doJoin(roomId);
	localVideo.srcObject = stream;
    localStream = stream;
}


function initLocalStream() {
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    }).then(openLocalStream).catch(function(e) {
        alert("getUserMedia() error: " + e.name);
    });
}


document.getElementById('joinBtn').onclick = function() {
	roomId=document.getElementById("zero-RoomId").value;
	if(roomId==""||roomId=="请输入房间ID"){
		alert("请输入房间ID");
		return;
	}
    initLocalStream();// 初始化本地码流
}

document.getElementById("leaveBtn").onclick=function(){
	doLeave();
}

function doLeave() {
    var jsonMsg = {
        'cmd': 'leave',
        'roomId': roomId,
        'uid': localUserId,
    };
    var message = JSON.stringify(jsonMsg);
    rtcEngine.sendMessage(message);
    console.info("doLeave message: " + message);
	hangup();
}

function hangup(){
	remoteStream.srcObject=null;//不显示对方
	closeLocalStream();//关闭本地流
	if(pc!=null){
		pc.close();//关闭RTCPeerConnection
		pc=null;
	}
}

function closeLocalStream() {
    if(localStream != null) {
        localStream.getTracks().forEach((track) => {
                track.stop();
        });
    }
}