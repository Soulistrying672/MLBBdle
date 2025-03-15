document.addEventListener("DOMContentLoaded", () => {
  const guessInput = document.getElementById("guess-input");
  const guessButton = document.getElementById("guess-button");
  const themeToggle = document.getElementById("theme-toggle");
  const resultDisplay = document.getElementById("result");
  const guessesTable = document.getElementById("guesses-table");
  const heroImageContainer = document.getElementById("hero-image-container");
  const autocompleteList = document.getElementById("autocomplete-list");

  let heroesData = [];
  let targetHero = null;
  let guessedHeroes = [];

  // Fetch the local JSON
  fetch("heroes_local.json")
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load JSON (Status: ${response.status})`);
      }
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("JSON is empty or incorrectly formatted.");
      }

      heroesData = data;
      targetHero = heroesData[getDailyIndex(heroesData.length)];

      console.log("Daily Hero:", targetHero);
    })
    .catch(error => {
      console.error("Error Loading JSON:", error);
      resultDisplay.innerText = "⚠️ Error loading hero data. Check console.";
    });

  // Return a stable "day-based" index
  function getDailyIndex(arrayLength) {
    const now = new Date();
    const dayNumber = Math.floor(Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ) / 86400000);
    return dayNumber % arrayLength;
  }

  /* ===========================
       CUSTOM AUTOCOMPLETE
     =========================== */
  // We'll do a simple "starts with" filter for the displayed suggestions,
  // but the guess itself will be fuzzy matched (Levenshtein) in handleGuess().

  guessInput.addEventListener("input", onInputChange);
  guessInput.addEventListener("blur", () => {
    // small timeout so if user clicks a suggestion we don't immediately hide
    setTimeout(() => {
      autocompleteList.innerHTML = "";
    }, 200);
  });

  function onInputChange() {
    const val = guessInput.value.trim().toLowerCase();
    autocompleteList.innerHTML = "";

    if (!val || heroesData.length === 0) return;

    // Let's show up to 8 suggestions
    const matched = heroesData.filter(h =>
      h.name.toLowerCase().startsWith(val)
    ).slice(0, 8);

    matched.forEach(hero => {
      const li = document.createElement("li");
      li.innerHTML = `
        <img src="${hero.icon_url}" alt="${hero.name}" class="autocomplete-item-icon" />
        <span>${hero.name}</span>
      `;

      li.addEventListener("click", () => {
        // If user clicks a suggestion, set input to that hero name
        guessInput.value = hero.name;
        autocompleteList.innerHTML = "";
      });

      autocompleteList.appendChild(li);
    });
  }

  /* ===========================
       GUESS MATCHING LOGIC
     =========================== */

  guessButton.addEventListener("click", handleGuess);
  guessInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      handleGuess();
    }
  });

  function handleGuess() {
    const guess = guessInput.value.trim().toLowerCase();
    if (!guess || heroesData.length === 0) {
      resultDisplay.innerText = "⚠️ No heroes loaded or invalid guess.";
      return;
    }
    if (!targetHero) {
      resultDisplay.innerText = "⚠️ Still loading data, please wait.";
      return;
    }

    if (guessedHeroes.includes(guess)) {
      resultDisplay.innerText = "⚠️ You already guessed that hero!";
      return;
    }

    // Attempt exact match first
    let guessedHero = heroesData.find(h => h.name.toLowerCase() === guess);

    // If none, do fuzzy
    if (!guessedHero) {
      guessedHero = findClosestHero(guess, heroesData);
      if (!guessedHero) {
        resultDisplay.innerText = "❌ Hero not found!";
        return;
      }
    }

    // Mark as guessed so we don't guess again
    guessedHeroes.push(guessedHero.name.toLowerCase());

    // Build table row
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td><img src="${guessedHero.icon_url}" alt="${guessedHero.name}" class="hero-icon"></td>
      ${checkProperty(guessedHero.role, targetHero.role)}
      ${checkProperty(guessedHero.species, targetHero.species)}
      ${checkProperty(guessedHero.resource, targetHero.resource)}
      ${checkProperty(guessedHero.range, targetHero.range)}
      ${checkProperty(guessedHero.region, targetHero.region)}
      ${checkProperty(guessedHero.lane, targetHero.lane)}
      ${checkProperty(guessedHero.year, targetHero.year)}
    `;

    guessesTable.insertBefore(newRow, guessesTable.firstChild);

    // If correct
    if (guessedHero.name.toLowerCase() === targetHero.name.toLowerCase()) {
      resultDisplay.innerText = "✅ Correct! That’s the daily hero!";
      heroImageContainer.innerHTML = `
        <img src="${guessedHero.portrait_url}" alt="${guessedHero.name}" class="hero-portrait">
      `;
    } else {
      resultDisplay.innerText = "❌ Not the daily hero.";
    }
  }

  // Compare table cell property
  function checkProperty(guessValue, targetValue) {
    if (!guessValue || !targetValue) {
      return `<td class="incorrect">${guessValue || "N/A"}</td>`;
    }
    if (guessValue.toLowerCase() === targetValue.toLowerCase()) {
      return `<td class="correct">${guessValue}</td>`;
    }
    if (targetValue.toLowerCase().includes(guessValue.toLowerCase())) {
      return `<td class="partial">${guessValue}</td>`;
    }
    return `<td class="incorrect">${guessValue}</td>`;
  }

  /* ===========================
       FUZZY MATCH (LEVENSHTEIN)
     =========================== */
  function editDistance(str1, str2) {
    // remove non-alphanumerics for more "fuzzy" matching
    str1 = str1.replace(/[^a-z0-9]/gi, "").toLowerCase();
    str2 = str2.replace(/[^a-z0-9]/gi, "").toLowerCase();

    const len1 = str1.length;
    const len2 = str2.length;
    const dp = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1));

    for (let i = 0; i <= len1; i++) {
      for (let j = 0; j <= len2; j++) {
        if (i === 0) {
          dp[i][j] = j;
        } else if (j === 0) {
          dp[i][j] = i;
        } else {
          dp[i][j] =
            str1[i - 1] === str2[j - 1]
              ? dp[i - 1][j - 1]
              : 1 +
                Math.min(
                  dp[i - 1][j], // deletion
                  dp[i][j - 1], // insertion
                  dp[i - 1][j - 1] // substitution
                );
        }
      }
    }
    return dp[len1][len2];
  }

  function findClosestHero(guess, heroesList) {
    let bestHero = null;
    let bestDistance = Infinity;

    for (const h of heroesList) {
      const distance = editDistance(guess, h.name);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestHero = h;
      }
    }
    return bestDistance <= 3 ? bestHero : null;
  }

  // Theme Toggle
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
  });
});
