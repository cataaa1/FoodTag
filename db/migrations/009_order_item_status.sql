alter table order_item
  add column status text not null default 'pending'
  check (status in ('pending', 'preparing', 'ready', 'delivered'));

update order_item
set status = (
  select case customer_order.status
    when 'preparing' then 'preparing'
    when 'ready' then 'ready'
    when 'delivered' then 'delivered'
    else 'pending'
  end
  from customer_order
  where customer_order.id = order_item.order_id
);

create index if not exists idx_order_item_status on order_item(order_id, status);
