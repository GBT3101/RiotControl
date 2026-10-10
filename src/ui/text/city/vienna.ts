/**
 * VIENNA — city copy (E5). Fields and limits: ../cities.ts.
 */
import type { CityCopy } from '../cities';

export const vienna: CityCopy = {
  name: 'Vienna',
  tagline: 'Revolution? Nur mit Termin.',
  capitol: 'Parlament',
  victoryDecks: [
    'Ministry hails "proportionate response". Pallas Athene, out front, declines to comment.',
    'Order restored on the Ring. Cafés never closed. The waiter has still not brought the bill.',
    'Minister celebrates with a Melange and a strudel. Claims both on expenses. Approved.',
    'Calm returns. Fiaker horses resume their usual expression of mild disapproval.',
  ],
  defeatDecks: [
    'Protesters waltz on the Parlament. Minister last seen boarding a "routine" Fiaker.',
    'Regime falls. Application for regime change filed in triplicate, stamped, approved.',
    'Crowd storms the Hofburg, orders Sachertorte, complains about the service. Very Viennese.',
  ],
  welcome: 'Servus, Minister. Vienna: cake, coffee and paperwork. We brought the paperwork.',
  flavour: [
    'A breather. In Vienna we call it a Jause. Fifteen minutes, as per regulation.',
    'The protesters filled in a form to protest. Rejected. Wrong colour of ink.',
    'Everything here is either forbidden or compulsory. I find it very restful.',
    'Someone is playing a waltz. The riot police are swaying. Disciplinary action due.',
  ],
  masthead: {
    title: 'Amtsschimmel',
    dateline: 'WIEN · EXTRAAUSGABE · 2 €',
    motto: '»Alles Walzer, nichts Neues«',
  },
  slogans: ['OIDA', 'HEAST', 'GEH!', 'NEIN!', 'NA JA', 'WURST', 'GENUG'],
};
