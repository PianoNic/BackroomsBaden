import { useState } from "preact/hooks";
import type { CatalogItem, CosmeticCategory, EquippedCosmetics } from "../../../../net/protocol";
import { Button } from "../../components/controls";
import { Scroll } from "../../components/layout";
import { SHOP_CATEGORIES } from "../../state/shop";
import { ShopCatalogView } from "../../state/shopCatalogView";

export type ShopAdapter = {
  signedIn: boolean;
  balance: number;
  owned: Set<string>;
  equipped: EquippedCosmetics;
  note: string;
  catalog: CatalogItem[];
  buy: (cosmeticId: string) => void;
  equip: (category: CosmeticCategory, cosmeticId: string) => void;
};

export function ShopBody(props: {
  adapter: ShopAdapter;
  backLabel: string;
  onBack: () => void;
}) {
  const [active, setActive] = useState<CosmeticCategory>("body");
  const { adapter } = props;
  const items = ShopCatalogView.inCategory(adapter.catalog, active);
  const featured = ShopCatalogView.featured(adapter.catalog);

  return (
    <>
      <div class="shop-header">
        <span>SYS://SHOP</span>
        <span class="shop-balance">{adapter.signedIn ? `${adapter.balance} coins` : "guest"}</span>
      </div>
      {featured.length > 0 && (
        <section class="shop-featured" aria-label="Daily featured">
          <div class="shop-featured-title">DAILY FEATURED</div>
          <div class="shop-featured-row">
            {featured.map((item) => <ShopCard key={item.id} item={item} adapter={adapter} />)}
          </div>
        </section>
      )}
      <div class="bb-tabs" role="tablist" aria-label="Cosmetic categories">
        {SHOP_CATEGORIES.map((cat) => (
          <button
            type="button"
            key={cat.key}
            role="tab"
            aria-selected={cat.key === active}
            class={cat.key === active ? "bb-tab active" : "bb-tab"}
            onClick={() => setActive(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <Scroll>
        <div class="bb-cardgrid">
          {items.map((item) => <ShopCard key={item.id} item={item} adapter={adapter} />)}
        </div>
      </Scroll>
      <div class="shop-note">{adapter.note}</div>
      <Button variant="back" class="screen-back" onClick={props.onBack}>{props.backLabel}</Button>
    </>
  );
}

function ShopCard(props: { item: CatalogItem; adapter: ShopAdapter }) {
  const { item, adapter } = props;
  const owned = adapter.owned.has(item.id);
  const equipped = adapter.equipped[item.category] === item.id;
  const locked = ShopCatalogView.isLocked(item, adapter.owned);
  return (
    <div class={`shop-card rarity-${item.rarity}${item.featured ? " is-featured" : ""}`}>
      <div class="shop-card-preview" aria-hidden="true">{item.name.charAt(0)}</div>
      <div class="shop-card-name">{item.name}</div>
      <div class="shop-card-rarity">{item.rarity}</div>
      {equipped ? (
        <Button small disabled class="shop-action is-equipped">EQUIPPED</Button>
      ) : owned ? (
        <Button
          small
          class="shop-action"
          onClick={() => adapter.equip(item.category, item.id)}
        >
          EQUIP
        </Button>
      ) : locked ? (
        <div class="shop-locked">{ShopCatalogView.lockedLabel(item)}</div>
      ) : (
        <Button
          small
          class="shop-action"
          disabled={!adapter.signedIn || adapter.balance < item.price}
          onClick={() => adapter.buy(item.id)}
        >
          {`BUY · ${item.price}`}
        </Button>
      )}
    </div>
  );
}
