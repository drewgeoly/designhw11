export async function UserSelectionModal() {
    return {
      props: {
        show: { type: Boolean, default: false },
        users: { type: Array, default: () => [] }
      },
      data() {
        return {
          searchTerm: ''
        };
      },
      computed: {
        filteredUsers() {
          if (!this.searchTerm.trim()) {
            return this.users;
          }
          const searchLower = this.searchTerm.toLowerCase();
          return this.users.filter(user => 
            user.username.toLowerCase().includes(searchLower)
          );
        }
      },
      methods: {
        selectUser(user) {
          this.$emit('select-user', user.username);
          this.close();
        },
        close() {
          this.searchTerm = '';
          this.$emit('close');
        }
      },
      template: await fetch("./user-selection-modal.html").then(r => r.text())
    };
  }