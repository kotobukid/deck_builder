import express, {NextFunction, Request, Response, Router} from "express";
import {PrismaClient} from "@prisma/client";
import {CardDataClient, EPS} from "../types/card.js";
import {Product} from "../types/app.js";
import {procedure as fetch_product_data} from "../sample/scraping/procedure.js";
import {check_is_admin, check_is_admin_json} from "./api_auth.js";
import fs from "node:fs";
import Redis from "ioredis";

const prisma: PrismaClient = new PrismaClient();

const admin_router: Router = express.Router();

admin_router.get('/card_detail/:slug', check_is_admin_json, async (req: Request<{
    slug: string
}>, res: Response, next: NextFunction): Promise<any> => {
    const slug: string = req.params.slug;

    // @ts-ignore
    const card_detail: CardDataClient | null = await prisma.card.findFirst({
        where: {
            slug
        }
    });

    // @ts-ignore
    const epss: EPS[] = await prisma.ExtendParameterSetting.findMany({
        where: {
            slug
        }
    });

    if (card_detail) {
        res.json({card: card_detail, epss});
    } else {
        next(404);
    }
});

admin_router.post('/update_eps', check_is_admin_json, (req: Request<{ eps: EPS }>, res: Response<{
    epss: EPS[]
}>): void => {
    const data = req.body.eps;
    const data_id_removed = {...data};
    delete data_id_removed.id

    // @ts-ignore
    prisma.ExtendParameterSetting.upsert({
        where: {id: data.id},
        create: data_id_removed,
        update: data
    }).then((): void => {
        // @ts-ignore
        prisma.ExtendParameterSetting.findMany({
            where: {slug: data.slug}
        }).then((epss: EPS[]): void => {
            res.json({epss});
        });
    });
});

admin_router.get('/products', check_is_admin, async (req: Request, res: Response<{
    products: Product[]
}>): Promise<void> => {
    // @ts-ignore
    const products: Product[] | null = await prisma["product"].findMany({});

    if (products) {
        res.json({
            products
        });
    } else {
        res.json({products: []});
    }
});

admin_router.post('/update_product', check_is_admin_json, async (req: Request<{ product: Product }>, res: Response<{
    success: boolean,
    product: Product
}>): Promise<void> => {
    const product: Product = {...req.body["product"]};
    const new_product: Product = (() => {
        const p: Product = {...product};
        // @ts-ignore
        delete p.id;
        delete p.last_converted;
        delete p.last_fetched;
        return p;
    })();

    // @ts-ignore
    const inserted_or_updated: Product = await prisma["product"].upsert({
        where: {
            id: product.id
        },
        update: product,
        create: new_product
    });
    res.json({
        success: true,
        product: inserted_or_updated
    });
});

admin_router.post('/fetch_items', check_is_admin_json, async (req: Request<{ id: number }>, res: Response<{
    success: boolean,
    product_no?: string,
    last_fetched?: string,
    reason?: string
}>): Promise<void> => {
    // @ts-ignore
    const product: Product | null = await prisma["product"].findFirst({
        where: {
            id: req.body.id
        }
    });

    if (product) {
        const payload = {
            product_no: product.product_no,
            product_type: product.product_type,
            virtual_product_no: '',
            sort: product.sort
        };

        // payload.virtual_product_no = req.body.virtual_product_no || '';

        fetch_product_data(payload, req.app.locals.text_cache_dir, false).then(async (): Promise<void> => {
            const last_fetched: Date = new Date();
            await prisma["product"].update({
                where: {id: req.body.id},
                data: {
                    last_fetched
                }
            });
            res.json({
                success: true,
                product_no: product.product_no,
                last_fetched: last_fetched.toString()
            });
        }).catch((e): void => {
            res.json({success: false, reason: e.toString()})
        });
    } else {
        res.json({success: false});
    }
});

const zenkakuToHankaku = (str: string): string => {
    str = str.replace(/[Ａ-Ｚａ-ｚ０-９：＼／！]/g, function (s: string) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
    str = str.replace(/（/g, "(").replace(/）/g, ")");
    return str;
};

const apply_eps = (card: CardDataClient, epss: EPS[]): CardDataClient => {

    for (let i = 0; i < epss.length; i++) {
        if (epss[i].slug === card.slug) {
            if (epss[i].method === 'extend') {
                card = {...card, ...JSON.parse(epss[i].json)};
                // console.log(`extend setting applied. slug: ${card.slug} data: ${epss[i].json} `);
            }
        }
    }
    card.name = card.name.replace(/\(/, '<br />(');
    card.name = zenkakuToHankaku(card.name);

    return card;
};

admin_router.post('/publish_cards', check_is_admin_json, async (req: Request, res: Response<{
    success: boolean
}>): Promise<void> => {
    // @ts-ignore
    const cards: CardDataClient[] = await prisma.card.findMany({
        orderBy: [
            {
                // @ts-ignore
                sort: 'desc',
            },
        ]
    });

    // @ts-ignore
    const ep_settings: EPS[] = await prisma.ExtendParameterSetting.findMany();

    console.log('publishing start');

    const cards_modified: CardDataClient[] = cards.map((card: CardDataClient) => {
        return apply_eps(card, ep_settings);
    });

    // @ts-ignore
    const redis: Redis = req.app.locals.redis_data;
    const keys_to_delete: string[] = await redis.keys('prevnext/*');
    for (let key of keys_to_delete) {
        await redis.del(key);
    }
    for (let i: number = 0; i < cards_modified.length; i++) {
        const prev = cards_modified[i === 0 ? (cards_modified.length - 1) : (i - 1)].slug;
        const next = cards_modified[i === cards_modified.length - 1 ? (0) : (i + 1)].slug;
        const prevNext = {
            prev, next
        };

        cards_modified[i].prev = prev;
        cards_modified[i].next = next;
        await redis.hmset(`prevnext/${cards_modified[i].slug}`, prevNext);
    }

    fs.writeFile('./static/generated/cards.json', JSON.stringify({cards: cards_modified}), {encoding: 'utf-8'}, (err: Error | null) => {
        if (err) {
            console.error(err)
        }
        console.log('publishing complete');
        res.json({
            success: true
        });
    });
});

export {admin_router, zenkakuToHankaku, apply_eps}