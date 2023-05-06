<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import type {CardData} from '../../../ex/types/card.js'
import axios, {type AxiosResponse} from "axios";
import CardDetail from "./CardDetail.vue";

const cards = ref<CardData[]>([]);
const filter_word = ref('');
const deck_type = ref<1 | 2 | 0>(0);
// @ts-ignore
const target = ref<CardData>({slug: ''});

const set_target = (cd: CardData) => {
    target.value = cd;
};

onMounted(() => {
    axios.get('/g/cards.json').then((res: AxiosResponse<{ cards: CardData[] }>) => {
        cards.value = res.data.cards;
    });
});

const filtered_cards = computed(() => {
    const fw = filter_word.value.trim().toUpperCase();
    const skip: boolean = fw !== '' && deck_type.value !== 0;
    if (skip) {
        return cards.value;
    } else {
        return cards.value.filter((c: CardData) => {
            return (c.name.indexOf(fw) > -1)
                || (c.slug.indexOf(fw) > -1)
                || (c.pronounce.indexOf(fw) > -1)
                ;
        }).filter((c: CardData) => {
            if (deck_type.value === 1) {
                return ['シグニ', 'スペル'].includes(c.card_type);
            } else if (deck_type.value === 2) {
                return !['シグニ', 'スペル'].includes(c.card_type);
            } else {
                return true;
            }
        });
    }
});
</script>

<template lang="pug">
.left_side(style="width: 781px;")
    select.deck_type(v-model.number="deck_type")
        option(value="0") 指定しない
        option(value="1") メインデッキ
        option(value="2") ルリグデッキ
    input.filter_word(type="text" name="filter_word" v-model="filter_word")
    span.amount(v-text="`${filtered_cards.length} items`")
    table
        colgroup
            col(style="width: 140px;")
            col(style="width: 240px;")
            col(style="width: 60px;")
            col(style="width: 100px;")
            col(style="width: 60px;")
            col(style="width: 120px;")
            col(style="width: 60px;")

        thead
            tr
                th No.
                th 名前
                th 色
                th ルリグ
                th レベル
                th 種族
                th パワー
        tbody
            tr(v-for="c in filtered_cards" :key="c.slug" :data-color="c.color")
                td {{ c.slug }}
                td.card_name(@click="set_target(c)")
                    span {{ c.name }}
                td {{ c.color }}
                td {{ c.lrig }}
                td {{ c.level }}
                td {{ c.klass }}
                td(v-text="c.power.replace(/k/, '000')")
        tbody.not_found(v-if="filtered_cards.length === 0")
            tr
                td(colspan="7") 検索条件に合致するカードはありません。
.right_side.margin_left
    CardDetail(:card="target" v-if="target.slug")
</template>

<style scoped lang="less">
table {
    table-layout: fixed;
    border-collapse: collapse;
    background-color: white;
    color: black;
}

.card_name {
    cursor: pointer;

    &:hover {
        span {
            text-decoration: underline;
            color: blue;
        }
    }
}

th, td {
    border: 1px solid black;
}

th {
    background-color: #232323;
    color: white;
}

tr {
    &[data-color="白"] {
        background-color: #fff1b4;
    }

    &[data-color="青"] {
        background-color: #ffb4b4;
    }

    &[data-color="黒"] {
        background-color: #9263f9;
    }

    &[data-color="赤"] {
        background-color: #ffb4b4;
    }

    &[data-color="緑"] {
        background-color: #ccffb4;
    }

    &[data-color="無"] {
        background-color: #cfcfcf;
    }
}

.left_side, .right_side {
    float: left;
}

.left_side {
    width: 1000px;
}

.right_side {
    width: 500px;

    // ad hoc
    position: fixed;
    left: 820px;
}

//.margin_left {
//    margin-left: 5px;
//}
select.deck_type, input[type="text"].filter_word {
    //font-size: 1.2rem;
    //padding: 3px;
    //margin: 3px;
    //line-height: 1.3rem;
    font-family: inherit;
    font-size: 100%;
    line-height: 1.15;
    margin: 0 10px 0 0;
    padding: 0.5em 1em;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
}

select {
    background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'><path fill='none' stroke='black' stroke-linecap='round' d='M2 1L1 3h2zm0 0L3 3H1z'/></svg>");
    background-repeat: no-repeat;
    background-position: right 0.5em center;
    background-size: 0.65em auto;
    &.deck_type {
        padding-right: 2rem;
    }
}
</style>