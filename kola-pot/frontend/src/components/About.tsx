function About() {
  return (
    <div className="my-[50px] w-full">
      <div className="flex h-[84px] w-full items-center justify-center text-center font-instrument text-[36px] font-medium leading-[42px]">
        Kola Pot
        <br />
        on Stacks testnet
      </div>
      <p className="flex items-center justify-center text-center font-mono text-[12px] font-medium text-[#908E8E]">
        Open a community pot, chip in STX, claim it when the goal is met.
        <br />
        The typed forms below call the deployed kola-pot contract.
      </p>
    </div>
  );
}

export default About;
