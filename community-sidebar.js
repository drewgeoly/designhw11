export async function CommunitySidebar() {
  return {
    props: {
      allCommunities: {
        type: Array, default: () => []
      },
      joinedChannels: {
        type: Object,  default: () => new Set()
      },
      selectedCommunity: {
        type: Object, default: null
      },
      loading: {
        type: Boolean, default: false
      },
      creating: {
        type: Boolean,default: false
      }
    },
    data() {
      return {
        newCommunityName: "",
        premadeCommunities: [
          { name: "Biking in Boston", channel: "premade:biking" },
          { name: "Monday Bowling", channel: "premade:bowling" },
          { name: "Cooking Club", channel: "premade:cooking" },
          { name: "Photography Group", channel: "premade:photography" }
        ]
      };
    },
    async mounted() {
      
      if (!this.$graffitiSession.value) {
        this.$router.push('/');
      }
      this.$watch(
        () => this.$graffitiSession.value,
        (sess) => { 
          if (!sess){
            this.$router.push('/');
          }
        }
      );
    },
    computed: {
      joinedCommunities() {
        return this.allCommunities.filter(community => 
          this.joinedChannels.has(community.channel)
        );
      },
      
      // communities someone can jpin
      discoverableCommunities() {
        return this.allCommunities.filter(community => 
          !this.joinedChannels.has(community.channel)
        );
      },
      // decided to combine premade and discoverable communities
      // availablePremadeCommunities() {
      //   const premadeChannels = this.premadeCommunities.map(p => p.channel);
      //   return this.allCommunities.filter(community => 
      //     !this.joinedChannels.has(community.channel) && 
      //     community.channel.startsWith("premade:")
      //   );
      // }
    },
    methods: {
      isSelected(community) {
        return this.selectedCommunity && community.channel === this.selectedCommunity.channel;
      },
      
      selectCommunity(community) {
        this.$emit('select-community', community);
      },
      
      async createCommunity() {
        if (!this.newCommunityName.trim()) {
          return;
        }
        
        this.$emit('create-community', this.newCommunityName);
        this.newCommunityName = "";
      },
      
      joinCommunity(community) {
        if (confirm(`Do you want to join ${community.name}?`))
        this.$emit('join-community', community);
      },
      
      leaveCommunity(community) {
        if (confirm(`Are you sure you want to leave "${community.name}"?`)) {
          this.$emit('leave-community', community);
        }
      }
    },
    template: await fetch("./community-sidebar.html").then((r) => r.text())
  };
}