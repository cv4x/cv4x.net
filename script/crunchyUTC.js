// Run to convert times on Crunchyroll's schedule page to UTC
toUTC();
function toUTC() {
    // Crunchyroll always miscalculates my time zone... add 1 to compensate
    const offset = 1;
    for (const node of document.querySelectorAll(".available-time")) {
        let text = node.textContent.padStart(7, "0");
        let hour = Number(text.slice(0, 2));
        if (text.endsWith("am")) {
            if (hour === 12) {
                hour = 0;
            }
        } else if (text.endsWith("pm")) {
            if (hour < 12) {
                hour += 12;
            }
        } else {
            // Exit early since the script probably already ran against this node
            return;
        }
        const date = new Date();
        date.setHours(hour + offset);
        date.setMinutes(Number(text.slice(3, 5)));
        node.textContent = date.toISOString().slice(11, 16);
    };
}