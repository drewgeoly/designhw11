// chat-view.js
import { defineAsyncComponent } from "vue";
import { MessageItem } from "./message-item.js";

export async function ChatView() {
  return {
    components: {
      MessageItem: defineAsyncComponent(MessageItem)
    },
    props: {
      channel: {
        type: Object,
        default: null
      }
    },
    data() {
      return {
        messageObjects: [],
        myMessage: "",
        editingId: null,
        editText: "",
        renaming: false,
        renameText: "",
        sending: false,
        loading: false,
        editMode: false, // Property to control edit mode
        usernameCache: {}, // Cache usernames to avoid repeated lookups
      };
    },
    computed: {
      channelNameDisplay() {
        return this.channel ? (this.channel.isCommunity ? '#' : '') + this.channel.name : '—';
      },
      channelId() {
        return this.channel ? this.channel.channel : null;
      },
      showRenameOption() {
        // Only show rename option for communities, not for private chats
        return this.channel && this.channel.isCommunity;
      },
      messageSchema() {
        return {
          properties: {
            value: {
              required: ["type", "content", "published"],
              properties: {
                type: { const: "Message" },
                content: { type: "string" },
                published: { type: "number" },
              },
            },
          },
        };
      },
      usernameSchema() { // new for usernames
        return {
          type: "object",
          properties: {
            value: {
              type: "object",
              properties: {
                type: { const: "username" },
                username: { type: "string" },
                actor: { type: "string" }
              },
              required: ["type", "username", "actor"]
            }
          }
        };
      }
    },
    methods: {
      delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      },
      sortedMessages(messages) {
        // Sort messages by time sent to order properly
        if (!messages || !messages.length) return [];

        return [...messages].sort((a, b) => a.value.published - b.value.published);
      },
      
      toggleEditMode() {
        this.editMode = !this.editMode;
        if (!this.editMode) {
          // Exit any active editing when leaving edit mode
          this.cancelEdit();
        }
      },
      
      async checkUsernameSet() {
        const actor = this.$graffitiSession.value?.actor;
        if (this.usernameCache[actor]) {
          return true;
        }
        for await (const { object } of this.$graffiti.discover(["dgeolyUsernames"], this.usernameSchema)) {
          if (object.value.actor === actor) {
            this.usernameCache[actor] = object.value.username;
            return true;
          }
        }
        return false;
      },
      
      async getUsernameFromActor(actorId) {
        if (!actorId) {
          return "Unknown";
        } // first try cache tehehhe
        if (this.usernameCache[actorId]) {
          return this.usernameCache[actorId];
        }
        for await (const { object } of this.$graffiti.discover(["dgeolyUsernames"], this.usernameSchema)) {
          if (object.value.actor === actorId) {
            const username = object.value.username;
            // Cache the result
            this.usernameCache[actorId] = username;
            return username;
          }
        }
        return actorId;
      },
      
      async sendMessage(session) {
        if (!this.myMessage.trim() || !this.channelId) {
          return;
        }
        
        const hasUsername = await this.checkUsernameSet();
        if (!hasUsername) {
          alert("You must create a profile and username before messaging.");
          return;
        }
        
        this.sending = true;
        const me = session.actor || session.id;
        
        try {
          const senderName = await this.getUsernameFromActor(me);
          
          await this.$graffiti.put(
            {
              value: {
                type: "Message",
                content:this.myMessage,
                published: Date.now(),
                publishedBy: me,
                senderName: senderName,
              },
              channels: [this.channelId],
            },
            session
          );
          this.myMessage = "";
        } catch (error) {
          console.error("Error sending message:", error);
        } finally {
          this.sending = false;
        }
      },
      
      startEdit(message) {
        this.editingId = message.url;
        this.editText = message.value.content;
      },
      
      cancelEdit() {
        this.editingId = null;
        this.editText = "";
      },
      
      async applyEdit(message, newText) {
        try {
          await this.$graffiti.patch(
            { 
              value: [
                { 
                  op: "replace", 
                  path: "/content", 
                  value: newText 
                }
              ] 
            },
            message,
            this.$graffitiSession.value
          );
          this.cancelEdit();
          // No need to manually reload - graffiti-discover handles updates
        } catch (error) {
          console.error("Error editing message:", error);
        }
      },
      
      async deleteMessage(message) {
        try {
          await this.$graffiti.delete(message, this.$graffitiSession.value);
          // No need to manually reload - graffiti-discover handles updates
        } catch (error) {
          console.error("Error deleting message:", error);
        } 
      },
      
      async applyRename() {
        if (!this.renameText.trim() || !this.channel || !this.channelId) {
          return;
        }
        
        try {
          await this.$graffiti.put(
            {
              value: {
                name: this.renameText,
                describes: this.channelId,
              },
              channels: ["designftw"],
            },
            this.$graffitiSession.value
          );
          
          this.renameText = "";
          this.renaming = false;
          
          // Emit an event to notify parent components that a rename occurred
          this.$emit('channel-renamed', {
            channelId: this.channelId,
            newName: this.renameText
          });
        } catch (error) {
          console.error("Error renaming channel:", error);
        } finally {
          this.renaming = false;
        }
      },
      
      // For message styling
      isMine(message) {
        const me = this.$graffitiSession.value.actor || this.$graffitiSession.value.id;
        return message.value.publishedBy === me;
      }
    },
    template: await fetch("./chat-view.html").then((r) => r.text())
  };
}