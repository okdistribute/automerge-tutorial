let Automerge = require('automerge')

let docId = window.location.hash
let channel = new BroadcastChannel(docId)

// Initialize Document
let doc
let observable = new Automerge.Observable()

let localCopy = localStorage.getItem(docId)
if (localCopy) {
	let parsed = Uint8Array.from(Buffer.from(localCopy, 'base64'))
	doc = Automerge.load(parsed, { observable })
} else {
	doc = Automerge.init({ observable })
}

// DOM elements
let surveyContainer = document.createElement('div')
let question = document.createElement('h1')
let link = document.createElement('h3')
let answersContainer = document.createElement('ul')
let input = document.createElement('input')
let button = document.createElement('button')
button.setAttribute('type', 'submit')

function clickAnswer (doc, index) {
	return Automerge.change(doc, doc => {
		doc.answers[index].count.increment()
	})
}

function addAnswer (doc, value) {
	return Automerge.change(doc, (doc) => {
		if (!doc.question) doc.question = value
		if (!doc.answers) doc.answers = []
		else {
			doc.answers.push({
				value: input.value,
				count: new Automerge.Counter()
			})
		}
	})
}

surveyContainer.appendChild(question)
surveyContainer.appendChild(answersContainer)
surveyContainer.appendChild(link)
surveyContainer.appendChild(input)
surveyContainer.appendChild(button)
document.body.appendChild(surveyContainer)

render(doc)

observable.observe(doc, (diff, before, after, local, changes) => {
	render(after)
	save(after)
	if (local) broadcastChanges(changes)
})

function save (doc) {
	let bytes = Automerge.save(doc)
	let string = Buffer.from(bytes).toString('base64')
	localStorage.setItem(docId, string)
}

function render (newDoc) {
	question.innerHTML = newDoc.question ? newDoc.question : 'New Survey'
	input.setAttribute('type', 'text')
	button.innerText = newDoc.question ? 'Add Answer': 'Create Question' 

	newDoc.answers && newDoc.answers.forEach((answer, index) => {
		let objId = Automerge.getObjectId(answer)
		let answerEl = document.getElementById(objId) 
		if (!answerEl) {
			answerEl = document.createElement('li')
			answerEl.id = objId
			answersContainer.appendChild(answerEl)
		}
		answerEl.innerHTML = `${answer.value} ${answer.count}`
		answerEl.onclick = (ev) => {
			doc = clickAnswer(newDoc, index)
		}
	})

	button.onclick = (ev) => {
		doc = addAnswer(newDoc, input.value)
		input.value = null
	}
}

channel.onmessage = function (ev) {
	let payload = ev.data
	if (payload.actorId === Automerge.getActorId(doc)) return // this is from the same tab

	let [newDoc, patch] = Automerge.applyChanges(doc, payload.changes)
	doc = newDoc
	save(newDoc)
}

function broadcastChanges (changes) {
	let actorId = Automerge.getActorId(doc)
	channel.postMessage({
		actorId,
		changes
	})
}