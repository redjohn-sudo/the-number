# Le Numéro

A number comes up. Someone in the city will be part of a serious incident tonight,
as the victim or as the culprit. You have three minutes to find out which.

You play the AI watching the city. You can open their messages, bank records,
camera stills and call logs, and phone the people around them. Every file you open
costs the person some privacy, and your score rewards finding the truth without
looking at everything.

## What makes it work

Each case is written by a language model in a fixed order: **the truth first**,
then the clues, then the people around the person, each with a secret. At least one
of them lies, and every lie must be contradicted by a real clue. The server checks
these rules in code before a case is played, and rejects any case that breaks them.

The truth, the secrets and the lies never reach the browser. The people you call
are played by the model, and they only admit a lie when you quote the fact that
breaks it.

## Run it

```
python3 serveur.py --hors-ligne   # sample case, no API call
python3 serveur.py                # new cases generated live
```

Then open http://127.0.0.1:8420. Live mode needs a Nebius API key in
`NEBIUS_API_KEY` or `~/.config/jeu-enquete/nebius.env`. Nothing but the Python
standard library is required.

## Credits

Desk photo by Ruijia Wang on Unsplash (Unsplash License).

## Licence

All rights reserved. The code is public to be read, not reused. See `LICENSE`. The desk photo keeps its own Unsplash License.
