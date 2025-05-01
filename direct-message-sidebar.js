import { defineAsyncComponent } from "vue";

export async function DirectMessageSidebar() {
  return {
    props: {
      threads: { type: Array,  default: () => [] },
      selectedThread: { type: Object, default: null },
      loading: { type: Boolean, default: false }
    },
    methods: {
      select(thread) {
        this.$emit("select-thread", thread); // similar to my groupchats, but much more simple since just with individual users

      },
      create() {
        const peer = prompt("Enter username to message:");
        this.$emit("create-thread", peer);
      }
    },
    template: await fetch("./direct-message-sidebar.html").then(r => r.text())
  };
}