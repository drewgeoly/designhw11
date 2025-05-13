import { defineAsyncComponent } from "vue";
import { UserSelectionModal } from "./user-selection-modal.js";
export async function DirectMessageSidebar() {
  return {
    components: {
      UserSelectionModal: defineAsyncComponent(UserSelectionModal)
    },
    props: {
      threads: { type: Array, default: () => [] },
      selectedThread: { type: Object, default: null },
      loading: { type: Boolean, default: false },
      users: { type: Array, default: () => [] }
    },
    data() {
      return {
        showUserModal: false
      };
    },
    methods: {
      select(thread) {
        this.$emit("select-thread", thread); // similar to my groupchats, but much more simple since just with individual users

      },
      async create() {
        let set = await this.checkUsernameSet();
        if (set){
        this.showUserModal = true;}
        else{
          alert("You must create a profile and username before messaging.");
          return;

        }
      },
      handleUserSelect(username) {
        if (username && username.trim()) {
          this.$emit("create-thread", username.trim());
        }
        this.showUserModal = false;
      },
      async checkUsernameSet() {
        const schema = {
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
        const actor = this.$graffitiSession.value?.actor;
        const usernames = this.$graffiti.discover(["dgeolyUsernames"], schema);
        for await (const { object } of usernames) {
          if (object.value.actor === actor) {
            return true;
          }
        }
        return false;
    },
    },
    template: await fetch("./direct-message-sidebar.html").then(r => r.text())
  };
}