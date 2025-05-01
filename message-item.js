export async function MessageItem() {
  return {
    props: {
      message: { // all of my message data to hgelp with css and rendering
        type: Object, required: true
      },
      isMine: {
        type: Boolean, required: true
      },
      editMode: {
        type: Boolean, default: false
      },
      loading: {
        type: Boolean, default: false
      },
      sending: {
        type: Boolean, default: false
      },
      editingId: {
        type: String, default: null
      },
      editText: {
        type: String, default: ""
      }
    },
    data() {
      return {
        localEditText: this.editText
      };
    },
    watch: {
      editText(newValue) {
        this.localEditText = newValue;
      }
    },
    methods: {
      startEdit() { // this is the function that will be called when the user clicks the edit button and will be listening
        this.$emit('start-edit', this.message);
      },
      saveEdit() {
        this.$emit('save-edit', this.message, this.localEditText);
      },
      cancelEdit() {
        this.$emit('cancel-edit');
      },
      deleteMsg() {
        this.$emit('delete-message', this.message);
      },
      formatTime(timestamp) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        
        if (isToday) {
          return timeString; // just show the time if its today
        } else {
          const month = (date.getMonth() + 1).toString().padStart(2, '0'); // if its not today show the date tehehe
          const day = date.getDate().toString().padStart(2, '0'); //hopefully looks better than last weeks 
          
          return `${month}/${day} ${timeString}`;
        }
      }
    },
    template: await fetch("./message-item.html").then((r) => r.text())
  };
}