const deckU = require('./deck')

class Game {
    constructor(agent){
        this.defaults = {
            maxRounds: 8,
            maxPlayers: 4,
            maxPlays: 10
        }
        this.players = [
            {player: 'P1', team: 'teamA', hand: [], AI: true},
            {player: 'P2', team: 'teamB', hand: [], AI: false},
            {player: 'P3', team: 'teamA', hand: [], AI: false},
            {player: 'P4', team: 'teamB', hand: [], AI: false}
        ]
        this.agent = agent
        this.memory = []
        this.deck = deckU.makeDeck().deck
        this.turn = null
        this.trump = null
        this.firstRound = true
        this.tableCards = []
        this.playedCards = []
        this.totalPlayedCards = 0
        this.wonHands = { teamA: 0, teamB: 0 }
        this.gameScore = { teamA: 0, teamB: 0 } //teamA and teamB overall score
        this.playScore = { teamA: 0, teamB: 0 } //teamA and teamB play score
    }

    getDealer(){
        return this.firstRound 
            ? Math.floor(Math.random() * (4 - 0))
            : this.nextPlayer(this.dealer)
    }

    getWinner(){
        const {teamA, teamB} = this.gameScore
        const winner = teamA > teamB ? 'teamA' : 'teamB'
        this.gameOver = true
        console.log('Winner is', winner)
    }

    getRoundWinner(){
        const {teamA, teamB} = this.playScore
        if(teamA === teamB) {return}
        const winner = teamA > teamB ? 'teamA' : 'teamB'
        const winPoints = this.playScore[winner]
        let roundScore
        if(this.wonHands[winner] === 10){
            roundScore = 4
        } else {
            roundScore = winPoints > 90 ? 2 : 1
        }        
        this.gameScore[winner] += roundScore
        if(this.gameScore[winner] >= 4){
            this.gameOver = true
            console.log('Winner is', winner)
        }
        // console.log(this.agent.memory)
    }

    resetPlayScore(){
        this.playScore = { teamA: 0, teamB: 0 }
        this.wonHands = { teamA: 0, teamB: 0 }
        this.playedCards = []
    }

    nextPlayer(prev){
        const players = this.players
        const next = players.indexOf(players[prev + 1]) === -1
            ? 0
            : prev + 1
        return next
    }
    
    startGame(){
        for (let i = 0; i < this.defaults.maxRounds; i++) {
            if(this.gameOver){break}
            // console.log('Round:', i + 1)
            this.startRound()
            this.getRoundWinner()
            this.resetPlayScore()
            this.firstRound = false
            // console.log('Points:', this.gameScore)                 
        }
        !this.gameOver && this.getWinner()
    }

    dealHands(hands){
        let idx = this.starter
        for (let i = 0; i < hands.length; i++) {
            this.players[idx].hand = hands[i]
            idx = this.nextPlayer(idx)
        }
    }

    playOrder(){
        let idx = this.starter
        const ordered = []
        for (let i = 0; i < this.players.length; i++) {
            ordered.push(this.players[idx])
            idx = this.nextPlayer(idx)
        }
        return ordered
    }

    async playCard(cards){
        const isAI = this.players[this.turn].AI
        const data = {}
        let action
        let state
        if(isAI){
            data.trump = this.trump
            data.hand = cards
            data.table = this.tableCards
            data.played = this.playedCards
            state = this.agent.getState(data).then((s) => {
                action = this.agent.takeAction(s, cards.length)
            })
            
            console.debug(action)
            this.memory.push(state, action)
        } else {
            action = Math.floor(Math.random() * cards.length)
        }
        // console.log(cards[action])
        const pickCard = cards[action]
        const idxCard = this.players[this.turn].hand.indexOf(pickCard)
        this.tableCards.push(pickCard)
        this.playedCards.push(pickCard)
        this.players[this.turn].hand.splice(idxCard, 1)
    }

    validateCards(cards){
        // console.log(cards)
        const tableSuit = this.tableCards.length ? this.tableCards[0].suit : false
        const canFollowSuit = cards.some(c => c.suit === tableSuit)
        let playableCards
        if(!tableSuit || !canFollowSuit){
            playableCards = cards
        }
        if(canFollowSuit){
            playableCards = cards.filter(c => c.suit === tableSuit)
        }
        return playableCards
    }

    indexOfMax(arr) {
        if (arr.length === 0) {
            return -1
        }
    
        let max = arr[0].points
        let maxIndex = 0
    
        for (let i = 1; i < arr.length; i++) {
            if (arr[i].points > max && !arr[i].ignore) {
                maxIndex = i
                max = arr[i]
            }
        }
    
        return maxIndex
    }

    async trickWinner(order){
        const cards = this.tableCards
        console.debug('table cards', cards)
        const followSuit = cards[0].suit
        const points = cards.reduce((sum, c) => (sum += c.points), 0)
        cards.map((c, i) => c.suit !== followSuit && c.suit !== this.trump ? cards[i].ignore = true : c)
        const idxCard = this.indexOfMax(cards)
        const winner = order[idxCard]
        this.starter = this.players.indexOf(winner)
        this.playScore[winner.team] += points
        this.wonHands[winner.team]++
        const data = {}
        data.trump = this.trump
        data.hand = this.players[0].hand
        data.table = this.tableCards
        data.played = this.playedCards
        const nextState = Promise.resolve(this.agent.getState(data))
        const done = this.playedCards.length === 40
        console.debug(done)
        this.memory.push(points, nextState, done)
        if(this.agent.memory.length > this.agent.maxMem - 1){
            this.agent.memory.shift()
        }
        this.agent.memory.push(this.memory)
        if(done && this.agent.memory.length > this.agent.batchSize) {
            // console.log(agent.memory.length, batch_size)
            console.log('train')
            await this.agent.expReplay()//.then(console.debug('stopped training!')
            this.tableCards = []
            this.memory = []
            return
        }
        this.tableCards = []
        this.memory = []
    }

    playHands(){
        const order = this.playOrder()
        for (let i = 0; i < order.length; i++) {
            this.turn = this.players.indexOf(order[i])
            // console.log(order[i].hand)
            const hand = this.validateCards(order[i].hand)
            this.playCard(hand)
        }
        this.trickWinner(order)
    }

    startRound(){
        this.dealer = this.getDealer()
        let deck = deckU.shuffleDeck(this.deck)
        const side = Math.round(Math.random())
        this.trump = deckU.getTrump(deck, side)
        this.starter = this.nextPlayer(this.dealer)
        const hands = deckU.dealHand(deck, side)
        this.dealHands(hands, this.starter)
        for (let i = 0; i < this.defaults.maxPlays; i++) {
            // console.log('Vaza', i + 1)
            this.playHands()
        }
    }
}

module.exports = Game