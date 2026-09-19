# Food prices

A map of what Europe pays for its food, sector by sector, month by month, back
to 2005.

Live at https://food.themos.dev

## What you can do with it

Pick a sector along the top: olive oil, fruit, vegetables, meat, milk, wheat,
wine. Some carry a choice, so you can colour the map by extra virgin rather than
virgin, pork rather than beef, or tomatoes rather than vegetables as a whole.
Each sector is drawn in its own colour.

Meat is one button over three of the Commission's feeds, because cattle, pigs
and sheep are three endpoints there and one aisle at the butcher. The dropdown
picks the animal: beef, veal, pork, lamb, young lamb.

The choices are the things a shopper buys. The Commission also publishes feed
grain, lamp oil, and eight grades of cattle carcass sorted by the animal's age
and sex. Those are left out.

The map opens on each country's average price so far this year, which is the
steadiest thing to compare: less seasonal swing, and no country missing because
it filed late this month. The timeline steps a year at a time, back to 2005, and
the panel says when a year is still in progress. Untick "Yearly average" and it
steps through months instead, keeping your place.

Press play with the months showing and the map runs to last month in about
twenty seconds. Watch the two
numbers beside the colour ramp rather than the colours. On extra virgin olive oil
they read 3.39 to 7.31 euro a kilo in June 2022, climb to 8.77 to 12.6 by
January 2024, and fall back to 3.90 to 12.2 by mid 2026. The pattern on the map
barely moves. The scale underneath it nearly triples and then collapses.

Tick "against income" and the colours stop being euro. Every price is divided by
the median income of the country it comes from, so the map reads in minutes,
hours or days of that income per kilo. A kilo of beef in Bulgaria is measured
against a Bulgarian income rather than a Dutch one, and countries that look cheap
in euro tend to stop looking cheap. Beef in 2025 runs from about an hour and a
half of a median income per kilo in Denmark to five and a half in Romania.

Both sides of that division are in euro at the market rate, which is why there
is no purchasing power adjustment. A PPP adjusted income would be an income
already divided by a basket of prices that food is a large part of, and dividing
a food price by it counts the same thing twice. The ratio as it stands is
already a real one.

Where a sector reports organic prices too, a second tickbox switches to them and
the panel tells you what the premium is.

Click a country for its whole run, conventional against organic.

## Where the numbers come from

The European Commission collects what every member state reports for each
sector, usually one price per market per week. Those are averaged into a single
figure per country per month.

The incomes are Eurostat's median equivalised net income (ilc_di03), in euro,
one figure per country per year. Equivalised means per adult equivalent rather
than per head or per household: the second adult and the children in a house
count for less than the first, because two people sharing a kitchen do not need
two of everything.

A month takes its own year's figure. Eurostat's survey year reports the income
of the year before it, so the incomes run about a year behind the prices they
are dividing, which flatters recent years a little while prices are rising. And
the prices are what the farmer or the slaughterhouse is paid rather than what a
shop charges, so the days of income are the raw material's and not the shopping
bill's.

A country that reported nothing is left grey rather than given a colour that
would mean nothing.

Everything is a kilo, except wine, which is a litre. A hectolitre is a volume
and there is no honest way to weigh it.

The colours compare countries within the month you are looking at, so the
strongest colour is the dearest that month rather than the dearest ever. Prices
have roughly doubled over the period, which would otherwise paint every recent
month the same shade. The panel keeps each country's real run.

Light means cheap and dark means dear, in either theme. Each sector has its
own colour, so meat is red, wine purple, olive oil olive.
