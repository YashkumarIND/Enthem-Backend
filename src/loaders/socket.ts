import { createServer } from "http";
import { Server } from "socket.io";
import { Container } from "typedi";
import SocketService from "../services/socket_service";
import config from "../config";
import RoomService from "../services/room_service";
import { encrypt,decrypt } from "../services/encrypt";


export default (app) => {
  const server = createServer(app);
  const io = new Server(server);
  const socketService = Container.get(SocketService);
  const roomService = Container.get(RoomService);
  io.on("connection", (socket) => {
    console.log("Backend Connected");
    var roomID: string;
    var memberID:string;

    socket.on('disconnect', async () => {
      console.log("User removed");
      console.log(await roomService.removeMember(roomID, memberID));
    })

    socket.on('disconnect', async () => {
      console.log("User Disconnected");
      socket.leave(roomID);
    })

    //encryption and decryption in messages
    socket.on("sendMsg", (msg) => {
      console.log("Message received!", msg);
      const receiverChatID = msg.receiverChatID;
      const senderChatID = msg.senderChatID;
      const content = encrypt(msg.content, config.secretKEY); // Encrypt the message content using the secret key
      const encryptedMsg = {
        content: content,
        senderChatID: senderChatID,
        receiverChatID: receiverChatID,
      };
      socket.broadcast.in(receiverChatID).emit("sendMsgServer", encryptedMsg);
    });

    socket.on("receiveMsg", (msg) => {
      console.log("Encrypted message received!", msg);
      const receiverChatID = msg.receiverChatID;
      const senderChatID = msg.senderChatID;
      const content = decrypt(msg.content, config.secretKEY); // Decrypt the message content using the secret key
      const decryptedMsg = {
        content: content,
        senderChatID: senderChatID,
        receiverChatID: receiverChatID,
      };
      socket.broadcast.in(receiverChatID).emit("receiveMsgServer", decryptedMsg);
    });


    //delete chat room
    socket.on("deleteRoom", async (data) => {
      try {
        const {roomID, ownerID} = data;
        await roomService.deleteRoom(roomID, ownerID);
        socket.to(roomID).emit("groupDeleted", { message: "Group deleted by admin!" });
      } catch (error) {
        console.log(error);
      }
    });

    //add member to memberlist of chat room
    socket.on("joinRoom", async (data) => {
      try {
        const { id, memberID } = data;
        roomID = id;
        console.log(memberID);
        socket.join(roomID);
        console.log(await roomService.addMember(roomID, memberID));
        socket.to(roomID).emit("userJoinedRoom", { memberID });
      } catch (error) {
        console.log(error);
      }
    });

    //remove member from chat room by Admin(owner)
    socket.on("removeMember", async (data) => {
      try {
        const { roomID, memberID, ownerID } = data;
        await roomService.removeMember(roomID, memberID,ownerID);
        socket.to(roomID).emit("user removed by Admin", { memberID });
      } catch (error) {
        console.log(error);
      }
    });
    
    
  });
  
  server.listen(config.socketPort, () => {
    console.log(`Socket listening on ${config.socketPort}`);
  })
};
