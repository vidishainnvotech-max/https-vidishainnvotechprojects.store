
<?php

return [
    'reward_threshold' => (int) env('REFERRAL_REWARD_THRESHOLD', 5),
    'reward_discount_percent' => (float) env(
        'REFERRAL_REWARD_DISCOUNT_PERCENT',
        20
    ),
];
