const GUESS_EXACT = 'letter-guess--exact';
const GUESS_PRESENT = 'letter-guess--present';
const GUESS_WRONG = 'letter-guess--absent';
const MAX_GUESSES = 6;

// Wraps a <tr>
class GuessRow {
	#row;

	constructor( row ) {
		this.#row = row;
	}

	// letters should be an array of 5 letters, classes should be the classes
	// to add for each
	setGuess( letters, classes ) {
		letters.forEach(
			( letter, idx ) => this.#row.children[idx].innerText = letter
		);
		// use .className to replace the existing value
		classes.forEach(
			( clazz, idx ) => this.#row.children[idx].className = clazz
		);
	}
}
// Wraps a <tbody>
class GuessTracker {
	#tableBody;
	#rows;
	#letterTracker;
	#nextGuess;

	constructor( tableBody, letterTracker ) {
		this.#tableBody = tableBody;
		this.#letterTracker = letterTracker;
		
		const makeCell = () => document.createElement( 'td' );
		const makeRow = () => {
			const row = document.createElement( 'tr' );
			row.append( makeCell(), makeCell(), makeCell(), makeCell(), makeCell() );
			this.#tableBody.append( row );
			return new GuessRow( row );
		};
		this.#rows = Array(MAX_GUESSES).fill().map(makeRow);
		this.#nextGuess = 0;
	}

	clear() {
		const noValues = [ '', '', '', '', '' ];
		this.#rows.forEach( ( r ) => r.setGuess( noValues, noValues ) );
		this.#nextGuess = 0;
		this.#letterTracker.reset();
	}

	get usedGuesses() {
		return this.#nextGuess;
	}

	static #getGuessClasses( guess, answer ) {
		// We only want to use GUESS_PRESENT for the first X instances of a letter,
		// after subtracting the exact matches
		const countByLetter = {};
		answer.split('').forEach( letter => {
			if (countByLetter[letter] === undefined) {
				countByLetter[letter] = 0;
			}
			countByLetter[letter]++;
		} );
		const result = [ GUESS_WRONG, GUESS_WRONG, GUESS_WRONG, GUESS_WRONG, GUESS_WRONG ];
		// GUESS_EXACT takes precedence
		guess.split('').forEach(
			(letter, idx) => {
				if (answer[idx] === letter) {
					result[idx] = GUESS_EXACT;
					countByLetter[letter]--;
				}
			}
		);
		// Now apply GUESS_PRESENT for the earliest applicable non-exact instances
		guess.split('').forEach(
			(letter, idx) => {
				// letter is in the answer and NOT already exact (in case there
				// are repeated letters)
				if (countByLetter[letter] !== 0
					&& countByLetter[letter] !== undefined
					&& result[idx] === GUESS_WRONG
				) {
					countByLetter[letter]--;
					result[idx] = GUESS_PRESENT;
				}
			}
		);
		return result;
	}

	addGuess( guess, answer ) {
		if ( this.#nextGuess >= this.#rows.length ) {
			throw new Error( "Too many guesses" );
		}
		const classes = GuessTracker.#getGuessClasses( guess, answer );
		classes.forEach(
			( clazz, idx ) => this.#letterTracker.recordStatus( guess[idx], clazz )
		);
		this.#rows[this.#nextGuess].setGuess(
			guess.split(''),
			classes
		);
		this.#nextGuess++;
		return guess === answer;
	}
}
class PopupManager {
	#wrapper;
	#label;
	#text;

	constructor( wrapper ) {
		this.#wrapper = wrapper;
		// no getElementById() on HTMLElement
		this.#label = wrapper.querySelector( '#popup-label' );
		this.#text = wrapper.querySelector( '#popup-text' );

		wrapper.querySelector( '#popup-close-btn' ).addEventListener(
			'click',
			() => this.hidePopup()
		);
	}
	
	hidePopup() {
		// use className so that showPopup can add custom classes
		this.#wrapper.classList = 'hidden';
	}

	showPopup( label, text, clazz ) {
		this.#label.innerText = label;
		this.#text.innerText = text;
		this.#wrapper.classList = clazz;
	}

	showStats() {
		const stats = CookieManager.getStats();

		let totalGuesses = 0;
		let totalPlays = 0;

		const statsDisplay = document.createElement( 'div' );
		const oneGuess = document.createElement( 'span' );
		oneGuess.innerText = '1 guess: ' + stats[ 1 ];
		statsDisplay.append( oneGuess );

		totalGuesses += stats[1];
		totalPlays += stats[1];

		// Failures go at the end
		stats.slice( 2 ).forEach(
			( value, adjustedIdx ) => {
				const currGuess = document.createElement( 'span' );
				currGuess.innerText = (adjustedIdx + 2) + ' guesses: ' + value;
				statsDisplay.append( currGuess );

				totalPlays += value;
				totalGuesses += (adjustedIdx + 2) * value;
			}
		);
		const average = document.createElement( 'span' );
		average.innerText = 'Average guesses: ' + ((totalGuesses / totalPlays) || 0.0).toFixed( 2 );
		statsDisplay.append( average );

		const failures = document.createElement( 'span' );
		failures.innerText = 'Unsuccessful attempts: ' + stats[0];
		statsDisplay.append( failures );

		this.#label.innerText = 'Statistics';
		this.#text.replaceChildren( statsDisplay );
		this.#wrapper.className = 'popup-style--stats';
	}
}
class LetterTracker {
	#letterDisplays;

	constructor( displayArea, useDvorak ) {
		this.#letterDisplays = {};
		const makeLetter = ( letter ) => {
			const cell = document.createElement( 'span' );
			if ( letter === '-' ) {
				cell.classList.add( 'letter-usage--spacer' );
			} else {
				cell.innerText = letter;
				this.#letterDisplays[ letter ] = cell;
			}
			return cell;
		};
		const makeRow = ( letters ) => {
			const row = document.createElement( 'div' );
			letters.split('').forEach(
				( letter ) => row.append( makeLetter( letter ) )
			);
			return row;
		};

		// each - adds half a cell width of space
		let rows = [ 'QWERTYUIOP', '-ASDFGHJKL', '--ZXCKBNM' ];
		if ( useDvorak ) {
			rows = [ '-----PYFGCRL', 'AOEUIDHTNS', '---QJKXBMWVZ' ];
		}
		rows.forEach(
			( row ) => displayArea.append( makeRow( row ) )
		);
	}

	reset() {
		Object.values( this.#letterDisplays ).forEach(
			( cell ) => cell.className = ''
		);
	}

	recordStatus( letter, status ) {
		const cell = this.#letterDisplays[ letter ];
		// If the new status is GUESS_EXACT, always set that
		if ( status === GUESS_EXACT ) {
			cell.className = GUESS_EXACT;
			return;
		}
		// If the new status is GUESS_WRONG and there is always a status set,
		// do nothing since either the status is already GUESS_WRONG or it is
		// better
		if ( status === GUESS_WRONG ) {
			if ( cell.className === '' ) {
				cell.className = GUESS_WRONG;
			}
			return;
		}
		// GUESS_PRESENT replaces GUESS_WRONG and empty, but not GUESS_EXACT;
		// only get here if status is GUESS_PRESENT
		if ( cell.className !== GUESS_EXACT ) {
			cell.className = GUESS_PRESENT;
		}
	}
}
class GameManager {
	#guessTracker;
	#popupManager;
	#inputFld;
	#submitBtn;
	#resetBtn;
	#answer;

	constructor( guessTracker, popupManager, inputFld, submitBtn, resetBtn ) {
		this.#guessTracker = guessTracker;
		this.#popupManager = popupManager;
		this.#inputFld = inputFld;
		this.#submitBtn = submitBtn;
		this.#resetBtn = resetBtn;
		this.#regenerateAnswer();
	}

	run() {
		this.#submitBtn.addEventListener(
			'click',
			() => this.submitGuess( this.#inputFld.value )
		);
		// allow using enter to submit guesses
		this.#inputFld.addEventListener( 'keyup', ( e ) => {
			if ( e.key === 'Enter' ) {
				this.submitGuess( this.#inputFld.value );
			}
		} );
		this.#resetBtn.addEventListener( 'click', () => this.#restart() );
	}

	#regenerateAnswer() {
		this.#answer = newAnswer();
		console.log( 'The answer is: ' + this.#answer );
	}

	#restart() {
		this.#guessTracker.clear();
		this.#regenerateAnswer();
		this.#resetBtn.classList.add( 'hidden' );
		this.#inputFld.disabled = false;
		this.#submitBtn.disabled = false;
	}

	submitGuess( guess ) {
		guess = guess.toUpperCase();
		checkValidGuess( guess ).then(
			() => this.#onValidGuess( guess ),
			() => this.#onInvalidGuess( guess )
		);
	}
	#onValidGuess( guess ) {
		const result = this.#guessTracker.addGuess( guess, this.#answer );
		this.#inputFld.value = '';
		if ( result ) {
			this.#popupManager.showPopup(
				'Congratulations',
				'The guess \'' + guess + '\' was correct!',
				'popup-style--correct'
			);
			CookieManager.incrementStat( this.#guessTracker.usedGuesses );
			this.#onGameEnd();
		} else if ( this.#guessTracker.usedGuesses === MAX_GUESSES ) {
			this.#popupManager.showPopup(
				'Sorry',
				'You failed to guess the correct answer, which was \'' + this.#answer + '\'.',
				'popup-style--lost'
			);
			// 0 = failure
			CookieManager.incrementStat( 0 );
			this.#onGameEnd();
		}
	}
	#onGameEnd() {
		this.#inputFld.disabled = true;
		this.#submitBtn.disabled = true;
		this.#resetBtn.classList.remove( 'hidden' );
	}
	#onInvalidGuess( guess ) {
		this.#popupManager.showPopup(
			'Error',
			'The guess \'' + guess + '\' is not a valid 5-letter word',
			'popup-style--invalid'
		);
	}
}

// Static methods for cookies
const COOKIE_NAME = 'wordle-game-stats';
class CookieManager {
	// Array for getting in 1 guess, 2 guesses, ... 6 guesses
	// where index 0 = times that you failed to get it, so that the index
	// matches the number of guesses
	// stored as 0|1|2|3|4|5|6
	static getStats() {
		const foundCookie = document.cookie.split(';')
			.map( ( s )=> s.trim() )
			.find( ( s ) => s.startsWith( COOKIE_NAME + '=' ) );
		if ( foundCookie === undefined ) {
			return [ 0, 0, 0, 0, 0, 0, 0 ];
		}
		// +1 for the = sign
		const cookieValue = foundCookie.substring( COOKIE_NAME.length + 1 );
		if ( !/^\d+(\|\d+){6}$/.test( cookieValue ) ) {
			// Someone is messing with their cookies - ignore everything
			return [ 0, 0, 0, 0, 0, 0, 0 ];
		}
		return cookieValue.split( '|' ).map( ( v ) => parseInt( v ) );
	}
	static clearCookie() {
		document.cookie = COOKIE_NAME + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
	}
	static setCookie( value ) {
		const asString = value.map( ( v ) => v.toString() ).join( '|' );
		// Cookies go until after CS120 is over
		const expiration = '; expires=Sat, 10 Aug 2024 00:00:00 UTC';
		document.cookie = COOKIE_NAME + "=" + asString + expiration;
	}
	static incrementStat( idx ) {
		const stats = CookieManager.getStats();
		stats[ idx ]++;
		CookieManager.setCookie( stats );
	}
}

const POSSIBLE_ANSWERS = [
	'APPLE',
	'BADLY',
	'CHAOS',
	'DETER',
	'ENTER',
	'FOUND',
	'GHOST',
	'HOUSE',
	'IGLOO',
	'JOINT',
	'KNEES',
	'LLAMA',
	'MADAM',
	'NOVEL',
	'ORBIT',
	'PLOWS',
	'QUIET',
	'RIOTS',
	'SIEVE',
	'TOMBS',
	'UNSET',
	'VAPID',
	'WASTE',
	'XENON',
	'YEARN',
	'ZEBRA',
	'EXTRA',
	'THOSE',
	'FEWER',
	'NEEDS',
	'ANNOY',
];
const newAnswer = () => {
	return POSSIBLE_ANSWERS[ Math.floor( Math.random() * POSSIBLE_ANSWERS.length ) ];
};

const checkValidGuess = ( guess ) => {
	return new Promise(
		( resolve, reject ) => {
			if ( ! (/^[A-Z]{5}$/.test( guess ) ) ) {
				// Not a string of 5 letters
				reject();
				return;
			}
			// fetch should be done lowercase though
			fetch(
				'https://api.dictionaryapi.dev/api/v2/entries/en/' + guess.toLowerCase()
			).then(
				( response ) => {
					if ( response.ok === true ) {
						resolve();
					} else {
						reject();
					}
				}
			);
		}
	);
};

document.addEventListener( 'DOMContentLoaded', () => {
	// I want to show the dvorak layout since that is what I use; if the
	// `usedvorak` query parameter is present that layout is used
	const useDvorak = new URLSearchParams( location.search ).get( 'usedvorak' ) !== null;
	const guessTracker = new GuessTracker(
		document.getElementById( 'guess-table-body' ),
		new LetterTracker( document.getElementById( 'letter-usage' ), useDvorak )
	);

	const popupManager = new PopupManager(
		document.getElementById( 'popup-wrapper' )
	);

	document.addEventListener( 'keyup', ( e ) => {
		if ( e.key === 'Escape' ) {
			popupManager.hidePopup();
		}
	} );

	const statBtn = document.getElementById( 'show-stats' );
	statBtn.addEventListener( 'click', () => popupManager.showStats() );

	// All of the logic is done in the instance of the GameManager
	const game = new GameManager(
		guessTracker,
		popupManager,
		document.getElementById( 'guess-input' ),
		document.getElementById( 'guess-submit' ),
		document.getElementById( 'restart-game' )
	);
	game.run();
} );