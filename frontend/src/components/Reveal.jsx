import { motion } from "framer-motion";
import { fadeUp } from "../lib/motion";

export default function Reveal({ children, delay = 0, as = "div", className = "", ...rest }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
