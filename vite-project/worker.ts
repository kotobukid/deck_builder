import {type CardDataClient} from "../ex/types/card.js";

let cards: CardDataClient[] = [];
let filter_word: string = '';
let color: string = '';
let card_type: string = '';
let has_lb: 0 | 1 | 2 = 0;
let format: 1 | 2 | 3 = 3;

const return_filtered = () => {
    const _filter_word = filter_word;
    const _color = color;
    const _card_type = card_type;
    const _has_lb = has_lb;
    const _format = format;

    let lb_card_type_filter!: (c: CardDataClient) => boolean;

    if (_has_lb === 0) {
        // LB指定なし
        lb_card_type_filter = (c: CardDataClient): boolean => {
            return c.card_type.indexOf(_card_type) > -1;
        };
    } else if (_has_lb === 1) {
        // LBありを指定
        if (['シグニ', 'スペル'].includes(_card_type)) {
            lb_card_type_filter = (c: CardDataClient): boolean => {
                return c.has_lb && c.card_type.indexOf(_card_type) > -1;
            };
        } else {
            lb_card_type_filter = (c: CardDataClient): boolean => {
                return c.has_lb && c.card_type.indexOf(_card_type) > -1;
            };
        }
    } else {    // _has_lb === 2
        // LBなしを指定
        lb_card_type_filter = (c: CardDataClient): boolean => {
            return (!c.has_lb) && c.card_type.indexOf(_card_type) > -1;
        }
    }

    self.postMessage({
        type: 'filtered', payload: cards.filter((c: CardDataClient) => {
            return c.name.indexOf(_filter_word) > -1;
        }).filter((c: CardDataClient) => {
            return c.color.indexOf(_color) > -1;
        }).filter(lb_card_type_filter)
            .filter((c: CardDataClient) => {
                return c.format >= _format;
            })
    });
};
self.addEventListener('message', (info: MessageEvent<{
    type: string,
    silent?: boolean,
    payload: any,
    format?: 1 | 2 | 3 | null
}>): void => {
    switch (info.data.type) {
        case 'initialize-cards':
            let f = info.data.format;
            if (info.data.format === null) {
                f = 3;
            }
            cards = info.data.payload;
            // @ts-ignore
            format = f;
            return_filtered();
            break;
        case 'filter_word':
            filter_word = info.data.payload;
            return_filtered();
            break;
        case 'color':
            color = info.data.payload;
            return_filtered();
            break;
        case 'card_type':
            card_type = info.data.payload;
            return_filtered();
            break;
        case 'has_lb':
            has_lb = info.data.payload;
            return_filtered();
            break;
        case 'format':
            format = info.data.payload;
            if (!info.data.silent) {
                return_filtered();
            }
            break;
        case 'refresh':
            return_filtered();
            break;
        default:
            console.error(`unknown message type: ${info.data.type}`);
            console.error(info);
            break;
    }
});